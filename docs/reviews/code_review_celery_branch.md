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

### 3. ~~Race Condition in `on_pod_ready`~~ (RESOLVED)

**Status**: RESOLVED

**Original Issue**: If `on_pod_ready` was called twice concurrently, both could queue the same job.

**Changes Made**:

- Refactored `queue_job` to use atomic compare-and-swap pattern
- Uses `UPDATE ... WHERE status = PENDING` to ensure only one worker can claim a job
- Returns `False` if job was already claimed by another worker

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

**Status**: RESOLVED (as part of Issue #1 and #6)

**Original Issue**: `get_executor_for_run` called Prime Intellect API on every command execution.

**Changes Made**:

- Database stores raw `ssh_connection` string from Prime Intellect
- `check_pending_run_statuses` task stores this when run becomes ACTIVE
- `get_executor_for_run` reads from database only, no API calls
- `SSHCommandExecutor.from_connection_string()` parses connection details internally

---

### 6. ~~Multiple Event Loops Created Wastefully~~ (RESOLVED)

**Status**: RESOLVED

**Original Issue**: Two separate event loops were created per task - one in `get_executor_for_run` to fetch pod status from API, another in `run_async()` for SSH commands.

**Changes Made**:

- `SSHCommandExecutor` now has `from_connection_string()` class method that parses the connection string internally
- Database stores raw `ssh_connection` string (single column instead of `pod_ip`, `pod_ssh_port`, `pod_ssh_user`)
- `get_executor_for_run` reads connection string from DB, no async/API calls
- Only `run_async()` creates an event loop now (for SSH command execution)
- Parsing logic centralized in `SSHCommandExecutor.from_connection_string()`

---

### 7. ~~Duplicate Database Engine/Session Factory~~ (RESOLVED)

**Status**: RESOLVED

**Original Issue**: Two separate engine/session factory patterns existed in `base.py`.

**Changes Made**:

- Removed duplicate `_db_engine` and `_Session` from `DatabaseTask` class
- `DatabaseTask` now uses module-level `_get_engine()` and `_get_session_factory()`
- Single shared connection pool for all database access

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

4. ~~**Add row locking in `on_pod_ready`**~~ - RESOLVED (atomic compare-and-swap)
5. ~~**Cache pod IP in database**~~ - RESOLVED (part of issue #1)
6. ~~**Consolidate database session management**~~ - RESOLVED

### Nice to Have

7. Separate `job_result` column from `job_config`
8. Standardize retry behavior across tasks
9. Fix duplicate JobCommand on retries
10. Consolidate `sys.path` manipulation
