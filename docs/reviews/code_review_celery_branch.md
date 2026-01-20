# Code Review: Celery Job Queue Branch

**Branch**: `cursor/celery-redis-job-queue-9e5d`  
**Review Date**: 2026-01-20  
**Commits Reviewed**: 7 commits (f588ddc → 5a297bc)

## Executive Summary

This branch implements a Celery-based job queue system for executing commands on GPU pods. While the core functionality works, there are several issues ranging from architectural concerns to edge case bugs that should be addressed before merging.

| Severity     | Count | Description                                          |
| ------------ | ----- | ---------------------------------------------------- |
| **Critical** | 1     | Architectural flaw - jobs depend on frontend polling |
| **High**     | 3     | Bugs that break functionality or pose security risks |
| **Medium**   | 4     | Design issues affecting maintainability/performance  |
| **Low**      | 4     | Code quality and minor edge cases                    |

---

## Critical: Architectural Issues

### 1. ~~Job Execution Depends on Frontend Polling~~ (RESOLVED)

**Status**: RESOLVED

**Original Issue**: `on_pod_ready` was only triggered when frontend polled `get_run_status`.

**Changes Made**:

- Added `check_pending_run_statuses` Celery Beat task (runs every 15s)
- Task fetches status from Prime Intellect API for PENDING/PROVISIONING runs
- Stores `pod_ip` and `pod_ssh_port` in database when run becomes ACTIVE
- Triggers `on_pod_ready` for newly active runs
- Frontend status endpoints now only read from database (no API calls, no job triggering)
- Added migration for `pod_ip` and `pod_ssh_port` columns on `runs` table

---

## High Severity Issues

### 2. ~~`run_custom_command` Doesn't Start Next Job on Exception~~ (RESOLVED)

**Status**: RESOLVED - Design clarified

**Original Issue**: Exception handlers didn't call `start_next_job_for_run`.

**Resolution**: After discussion, the correct design is that **sequential jobs should stop on failure**. If CLONE_REPO fails, LIST_FILES shouldn't run because it depends on the clone.

**Changes Made**:

- Removed `start_next_job_for_run` calls from ALL failure paths (not just exceptions)
- Only SUCCESS paths now trigger the next job in sequence
- Failed jobs can be retried via the API, which resumes the sequence on success

---

### 3. Race Condition in `on_pod_ready`

**Severity**: High  
**Location**: [apps/api/celery_app/tasks/pod_tasks.py:145-175](apps/api/celery_app/tasks/pod_tasks.py)

**Problem**: If `on_pod_ready` is called twice in quick succession (e.g., due to retry or duplicate trigger), both calls could queue the same job:

```python
# Call 1: Finds job with PENDING status
first_job = session.query(Job).filter(Job.status == JobStatus.PENDING)...

# Call 2 (before Call 1 commits): Also finds same job with PENDING status
first_job = session.query(Job).filter(Job.status == JobStatus.PENDING)...

# Both calls queue the same job
```

**Impact**: Same job executed multiple times, wasting resources and potentially causing conflicts.

**Recommendation**: Use `SELECT ... FOR UPDATE` to lock the row, or use an atomic compare-and-swap pattern:

```python
from sqlalchemy import update

# Atomic update: only updates if status is still PENDING
result = session.execute(
    update(Job)
    .where(Job.id == first_job.id, Job.status == JobStatus.PENDING)
    .values(status=JobStatus.QUEUED, celery_task_id=task.id)
)
if result.rowcount == 0:
    # Another worker already claimed this job
    return {"run_id": run_id, "started_job_id": None, "reason": "already_claimed"}
session.commit()
```

---

### 4. ~~Private Key Logged to Stdout~~ (RESOLVED)

**Status**: RESOLVED

**Original Issue**: First 50 characters of private key were logged.

**Changes Made**:

- Removed private key content from log message
- Changed to `logger.debug` (internal detail, not needed in normal logs)
- Only logs key length now (safe metadata)

---

## Medium Severity Issues

### 5. ~~Pod IP Fetched on Every Command Execution~~ (RESOLVED)

**Status**: RESOLVED (as part of Issue #1)

**Original Issue**: `get_executor_for_run` called Prime Intellect API on every command execution.

**Changes Made**:

- Added `pod_ip` and `pod_ssh_port` columns to `runs` table
- `check_pending_run_statuses` task stores these when run becomes ACTIVE
- `get_executor_for_run` can now read from database instead of calling API

**Note**: `get_executor_for_run` still calls the API as a fallback if `pod_ip` is not set. This could be updated to use the cached values exclusively.

---

### 6. Multiple Event Loops Created Wastefully

**Severity**: Medium  
**Location**: [apps/api/celery_app/tasks/repo_tasks.py:57-64, 106-113](apps/api/celery_app/tasks/repo_tasks.py)

**Problem**: Two separate event loops are created per task execution:

1. One in `get_executor_for_run` for fetching pod status:

```python
loop = asyncio.new_event_loop()
asyncio.set_event_loop(loop)
try:
    status_payload = loop.run_until_complete(fetch_pod_status([run.pod_id]))
finally:
    loop.close()
```

2. Another via `run_async()` for command execution:

```python
def run_async(coro):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()
```

**Impact**: Unnecessary overhead, potential for event loop issues.

**Recommendation**: If caching pod IP (issue #5), this is mostly resolved. Otherwise, consolidate into a single `run_async` call that does both operations.

---

### 7. Duplicate Database Engine/Session Factory

**Severity**: Medium  
**Location**: [apps/api/celery_app/tasks/base.py](apps/api/celery_app/tasks/base.py)

**Problem**: Two separate engine/session factory patterns exist in the same file:

**Module-level** (lines 25-64):

```python
_engine = None
_SessionFactory = None

def get_sync_session():
    session = _get_session_factory()()
    ...
```

**Class-level** (lines 88-124):

```python
class DatabaseTask(Task):
    _db_engine = None
    _Session = None

    def get_db_session(self):
        session = self.Session()
        ...
```

**Impact**:

- Confusing which to use
- Potentially two separate connection pools
- Code duplication

**Recommendation**: Consolidate to use only the `DatabaseTask` class methods. For `start_next_job_for_run`, either:

1. Make it a Celery task method, or
2. Have it accept a session parameter from the calling task

---

### 8. Results Mixed with Config in Same Column

**Severity**: Medium  
**Location**: [apps/api/celery_app/tasks/repo_tasks.py:344-350](apps/api/celery_app/tasks/repo_tasks.py)

**Problem**: Job results are stored by mutating the input config:

```python
job.job_config = {
    **config,  # Original input config
    "result": {  # Output results mixed in
        "files": files,
        "directories": directories,
    },
}
```

**Impact**:

- No clear separation between input and output
- Can't easily query jobs by original config
- Confusing data model

**Recommendation**: Add a separate `job_result` JSON column to the `jobs` table:

```python
# In database.py Job model
job_result = Column(JSON, nullable=True)

# In tasks
job.job_result = {"files": files, "directories": directories}
```

---

## Low Severity Issues

### 9. Job Status Flips FAILED → RUNNING on Retries

**Severity**: Low  
**Location**: [apps/api/celery_app/tasks/repo_tasks.py:248-257](apps/api/celery_app/tasks/repo_tasks.py)

**Problem**: Before retry, job is marked FAILED:

```python
job.status = JobStatus.FAILED
job.error_message = str(e)
session.commit()
raise self.retry(exc=e)  # On retry, status becomes RUNNING again
```

**Impact**: Confusing job history, status doesn't accurately reflect retry attempts.

**Recommendation**: Use a separate status like `RETRYING` or don't update status until all retries exhausted:

```python
except Exception as e:
    if self.request.retries < self.max_retries:
        # Will retry - don't mark as failed yet
        raise self.retry(exc=e)
    else:
        # Final failure
        job.status = JobStatus.FAILED
        job.error_message = str(e)
        session.commit()
```

---

### 10. Retries Create Duplicate JobCommand Records

**Severity**: Low  
**Location**: [apps/api/celery_app/tasks/repo_tasks.py:178](apps/api/celery_app/tasks/repo_tasks.py)

**Problem**: Each task execution creates a new JobCommand with `sequence=0`:

```python
cmd_id = self.record_command(job_id, clone_cmd, None, sequence=0)
```

If the task retries 3 times, there will be 3 JobCommand records all with `sequence=0`.

**Impact**: Unclear which command record is the "real" one, inflated command history.

**Recommendation**: Either:

1. Clear previous commands on retry, or
2. Increment sequence based on retry count:

```python
cmd_id = self.record_command(job_id, clone_cmd, None, sequence=self.request.retries)
```

---

### 11. Inconsistent Retry Behavior Across Tasks

**Severity**: Low  
**Location**: Multiple files in `tasks/`

**Problem**: Tasks handle exceptions differently:

| Task                 | On Exception              | Calls `start_next_job_for_run`? |
| -------------------- | ------------------------- | ------------------------------- |
| `clone_repository`   | `raise self.retry(exc=e)` | No (correct - stop on failure)  |
| `list_files`         | `raise self.retry(exc=e)` | No (correct - stop on failure)  |
| `run_custom_command` | `raise` (no retry)        | No (correct - stop on failure)  |

**Note**: The `start_next_job_for_run` column is now correct per design (jobs stop on failure). The inconsistency is only in retry behavior - `run_custom_command` doesn't retry while others do.

**Recommendation**: Decide if `run_custom_command` should also retry on exception, or if the others should not retry.

---

### 12. Repeated `sys.path` Manipulation

**Severity**: Low  
**Location**: Multiple files

**Problem**: The same `sys.path.insert` pattern appears in:

- `celery_app/__init__.py`
- `celery_app/tasks/base.py`
- `celery_app/tasks/pod_tasks.py`
- `celery_app/tasks/repo_tasks.py`

**Recommendation**: Consolidate to a single location (e.g., `celery_app/__init__.py`) that's imported first.

---

## Summary of Recommendations

### Must Fix Before Merge

1. ~~**Add periodic task to check run statuses**~~ - RESOLVED
2. ~~**Fix `run_custom_command` exception handler**~~ - RESOLVED (design clarified: stop on failure)
3. ~~**Remove private key logging**~~ - RESOLVED

### Should Fix

4. **Add row locking in `on_pod_ready`** - Prevent race condition
5. ~~**Cache pod IP in database**~~ - RESOLVED (part of issue #1)
6. **Consolidate database session management** - Remove duplication

### Nice to Have

7. Separate `job_result` column from `job_config`
8. Standardize retry behavior across tasks
9. Fix duplicate JobCommand on retries
10. Consolidate `sys.path` manipulation
