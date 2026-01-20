# Celery Redis Job Queue System

This document explains the implementation of the distributed job queue system using Celery with Redis Cloud for executing commands on GPU pods.

## Overview

The job queue system enables asynchronous execution of commands on GPU pods. When a run is created, jobs are automatically queued and execute when the pod becomes ready—independent of whether the client is polling.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Job Queue Architecture                             │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────────┐
                              │   Redis Cloud   │
                              │  (Broker &      │
                              │   Backend)      │
                              └────────┬────────┘
                                       │
           ┌───────────────────────────┼───────────────────────────┐
           │                           │                           │
           ▼                           ▼                           ▼
  ┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
  │  FastAPI Server │         │  Celery Worker  │         │  Celery Beat    │
  │                 │────────▶│                 │         │  (Scheduler)    │
  │ • Create jobs   │         │ • Execute tasks │         │                 │
  │ • Query status  │         │ • SSH to pods   │         │ • Poll pending  │
  │ • Cancel jobs   │         │ • Run commands  │         │   jobs (30s)    │
  └─────────────────┘         └────────┬────────┘         └─────────────────┘
           │                           │
           │                           │
           ▼                           ▼
  ┌─────────────────┐         ┌─────────────────┐
  │   PostgreSQL    │         │    GPU Pod      │
  │                 │         │ (Prime Intellect)│
  │ • Job state     │         │                 │
  │ • Command logs  │         │ • SSH access    │
  │ • Results       │         │ • Clone repos   │
  └─────────────────┘         └─────────────────┘
```

## Directory Structure

```
apps/api/
├── celery_app/
│   ├── __init__.py           # Celery app configuration
│   ├── config.py             # Settings (timeouts, retries, etc.)
│   ├── executors/
│   │   ├── __init__.py
│   │   ├── base.py           # CommandExecutor ABC, CommandResult
│   │   └── ssh.py            # SSH executor using asyncssh
│   └── tasks/
│       ├── __init__.py
│       ├── base.py           # DatabaseTask base class
│       ├── pod_tasks.py      # Pod lifecycle tasks
│       └── repo_tasks.py     # Repository operations
├── routers/
│   └── jobs.py               # Jobs API endpoints
└── alembic/versions/
    └── add_jobs_tables.py    # Database migration
```

## Core Components

### 1. CommandExecutor Abstraction

The `CommandExecutor` provides a clean interface for executing commands with structured results:

```python
from celery_app.executors import SSHCommandExecutor, CommandResult

# Create executor
executor = SSHCommandExecutor(
    host="192.168.1.100",
    port=22,
    username="root",
    private_key=private_key_string,
)

# Execute command
result: CommandResult = await executor.execute(
    "git clone https://github.com/owner/repo.git /workspace/repo",
    working_dir="/workspace",
    timeout_seconds=600,
    env={"GIT_SSH_COMMAND": "ssh -o StrictHostKeyChecking=no"},
)

# Check result
if result.success:
    print(f"Success! Output: {result.stdout}")
else:
    print(f"Failed: {result.error_message}")
    print(f"Exit code: {result.exit_code}")
    print(f"Stderr: {result.stderr}")
```

#### CommandResult Fields

| Field | Type | Description |
|-------|------|-------------|
| `stdout` | `str` | Standard output from command |
| `stderr` | `str` | Standard error from command |
| `exit_code` | `int \| None` | Process exit code |
| `status` | `CommandStatus` | PENDING, RUNNING, SUCCESS, FAILED, TIMEOUT, CANCELLED |
| `started_at` | `datetime` | When execution started |
| `completed_at` | `datetime` | When execution completed |
| `duration_ms` | `int` | Execution time in milliseconds |
| `error_message` | `str \| None` | Human-readable error description |
| `error_type` | `str \| None` | Error category (timeout, ssh_error, command_error) |

### 2. Database Models

#### Job Model

Tracks the lifecycle of a job:

```python
class Job(Base):
    __tablename__ = "jobs"
    
    id: int                    # Primary key
    run_id: int                # Associated run
    clerk_user_id: str         # Owner
    job_type: str              # CLONE_REPO, LIST_FILES, CUSTOM_COMMAND
    job_config: dict           # Type-specific configuration
    celery_task_id: str        # Celery task ID for tracking
    status: str                # PENDING, QUEUED, RUNNING, SUCCESS, FAILED, etc.
    sequence: int              # Execution order within run
    created_at: datetime
    started_at: datetime
    completed_at: datetime
    error_message: str         # Error details if failed
    error_type: str            # Error category
```

#### JobCommand Model

Records each command executed as part of a job:

```python
class JobCommand(Base):
    __tablename__ = "job_commands"
    
    id: int
    job_id: int                # Parent job
    command: str               # The command that was run
    working_dir: str           # Working directory
    stdout: str                # Command output
    stderr: str                # Error output
    exit_code: int             # Exit code
    status: str                # Command status
    started_at: datetime
    completed_at: datetime
    duration_ms: int           # Execution time
    sequence: int              # Order within job
```

### 3. Job Types

#### CLONE_REPO

Clones a Git repository to the pod:

```python
job_config = {
    "repo_url": "https://github.com/owner/repo.git",
    "branch": "main",
    "target_dir": "/workspace/repo",
    "depth": 1,  # Shallow clone (optional)
}
```

#### LIST_FILES

Lists files and directories in a path:

```python
job_config = {
    "target_dir": "/workspace/repo",
}

# Result stored in job_config after completion:
{
    "result": {
        "files": ["README.md", "main.py", "requirements.txt"],
        "directories": ["src", "tests", "docs"],
    }
}
```

#### CUSTOM_COMMAND

Executes an arbitrary command:

```python
job_config = {
    "command": "pip install -r requirements.txt",
    "working_dir": "/workspace/repo",
    "timeout_seconds": 300,
    "env": {"PIP_CACHE_DIR": "/tmp/pip-cache"},
}
```

### 4. Celery Tasks

#### check_pending_jobs (Periodic)

Runs every 30 seconds via Celery Beat. Finds jobs with status `PENDING` where the associated run is `ACTIVE`, then queues them for execution.

```python
@celery_app.task(bind=True, base=DatabaseTask)
def check_pending_jobs(self):
    # Find pending jobs with active runs
    # Queue appropriate task for each job type
    # Update job status to QUEUED
```

#### on_pod_ready

Triggered when a run's status changes to `ACTIVE`. Initiates job processing for that run.

```python
@celery_app.task(bind=True, base=DatabaseTask)
def on_pod_ready(self, run_id: int):
    # Trigger check_pending_jobs to process this run's jobs
```

#### clone_repository

Clones a repository to the pod via SSH:

```python
@celery_app.task(bind=True, base=DatabaseTask, max_retries=3)
def clone_repository(self, job_id: int):
    # Get SSH credentials from AWS Secrets Manager
    # Build git clone command
    # Create parent directory (mkdir -p) before cloning
    # Execute via SSHCommandExecutor (all async ops in single event loop)
    # Record results in JobCommand
    # Update Job status
```

**Note**: The clone task automatically creates the parent directory (e.g., `/workspace`) before cloning, since pods may not have this directory by default.

#### list_files

Lists directory contents:

```python
@celery_app.task(bind=True, base=DatabaseTask, max_retries=3)
def list_files(self, job_id: int):
    # Execute ls -1Ap via SSH
    # Parse output into files and directories
    # Store result in job_config
```

### 5. Async Execution Pattern

Since Celery tasks run in sync context but the SSH executor is async, we use a helper pattern that ensures all async operations run in a **single event loop**:

```python
def run_async(coro):
    """Helper to run async code in Celery tasks."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()
```

**Important**: All async operations for a single executor must be wrapped in one async function and executed via a single `run_async()` call. This prevents "Event loop is closed" errors:

```python
# CORRECT: Single event loop for all operations
async def execute_clone():
    try:
        await executor.execute(mkdir_cmd, timeout_seconds=30)
        return await executor.execute(clone_cmd, timeout_seconds=600)
    finally:
        await executor.close()

result = run_async(execute_clone())

# WRONG: Multiple event loops (causes "Event loop is closed")
run_async(executor.execute(mkdir_cmd))   # Loop 1 created and closed
run_async(executor.execute(clone_cmd))   # Loop 2 - executor connection invalid!
run_async(executor.close())              # Loop 3 - won't work
```

## Frontend Integration

### Jobs Panel

The run page displays a `JobsPanel` component that shows all jobs for a run with:

- Job type with icon (Clone Repository, List Files, Run Command)
- Status badge (Pending, Queued, Running, Success, Failed, etc.)
- Expandable details showing:
  - Command that was executed
  - Exit code and duration
  - Stdout output
  - Stderr output (only shown for **failed** commands)
  - Result data (e.g., file listings)
- Retry button for failed/cancelled/timeout jobs

### Output Display

- **Stdout**: Always shown when available
- **Stderr**: Only shown when command failed (exit code != 0)
  - Many tools (like git) write progress to stderr even on success
  - Hiding stderr for successful commands reduces noise

### Polling

The jobs panel polls for updates every 3 seconds while jobs are active (PENDING, QUEUED, or RUNNING). Polling stops when all jobs reach a terminal state or the run is terminated.

## API Endpoints

### Create Job

```http
POST /api/jobs
Content-Type: application/json

{
    "run_id": 123,
    "job_type": "CUSTOM_COMMAND",
    "config": {
        "command": "python train.py",
        "working_dir": "/workspace/repo"
    }
}
```

### List Jobs

```http
GET /api/jobs?run_id=123&status=SUCCESS
```

### Get Job Details

```http
GET /api/jobs/456
```

Response includes command history:

```json
{
    "id": 456,
    "run_id": 123,
    "job_type": "CLONE_REPO",
    "status": "SUCCESS",
    "config": {
        "repo_url": "https://github.com/owner/repo.git",
        "branch": "main"
    },
    "commands": [
        {
            "id": 1,
            "command": "git clone --depth 1 --branch main https://github.com/owner/repo.git /workspace/repo",
            "exit_code": 0,
            "status": "SUCCESS",
            "duration_ms": 5432
        }
    ]
}
```

### Cancel Job

```http
POST /api/jobs/456/cancel
```

Only works for `PENDING` or `QUEUED` jobs.

### Retry Job

```http
POST /api/jobs/456/retry
```

Works for `FAILED`, `CANCELLED`, or `TIMEOUT` jobs.

### Get Job Result

```http
GET /api/jobs/456/result
```

Returns the result stored in `job_config`:

```json
{
    "job_id": 456,
    "job_type": "LIST_FILES",
    "status": "SUCCESS",
    "result": {
        "files": ["README.md", "main.py"],
        "directories": ["src", "tests"]
    }
}
```

## Job Lifecycle

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ PENDING  │────▶│  QUEUED  │────▶│ RUNNING  │────▶│ SUCCESS  │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                │                │                 
     │                │                │           ┌──────────┐
     │                │                └──────────▶│  FAILED  │
     │                │                            └──────────┘
     │                │                                  
     │                │                            ┌──────────┐
     │                └───────────────────────────▶│ CANCELLED│
     │                                             └──────────┘
     │                                                   
     │                ┌──────────┐                       
     └───────────────▶│ CANCELLED│ (via API)             
                      └──────────┘                       
```

1. **PENDING**: Job created, waiting for pod to be ready
2. **QUEUED**: Added to Celery queue, waiting for worker
3. **RUNNING**: Currently executing on pod
4. **SUCCESS**: Completed successfully
5. **FAILED**: Execution failed (can retry)
6. **TIMEOUT**: Timed out (can retry)
7. **CANCELLED**: Cancelled by user (can retry)

## Integration with Runs

When a run is created, initial jobs are automatically added:

```python
# In routers/runs.py - create_run endpoint

# Job 1: Clone repository
clone_job = Job(
    run_id=run.id,
    job_type=JobType.CLONE_REPO,
    job_config={
        "repo_url": f"https://github.com/{project.repo_owner}/{project.repo_name}.git",
        "branch": body.branch,
        "target_dir": "/workspace/repo",
        "depth": 1,
    },
    status=JobStatus.PENDING,
    sequence=0,
)

# Job 2: List files
list_job = Job(
    run_id=run.id,
    job_type=JobType.LIST_FILES,
    job_config={"target_dir": "/workspace/repo"},
    status=JobStatus.PENDING,
    sequence=1,
)
```

When the run status is polled and becomes `ACTIVE`, job processing is triggered:

```python
# In routers/runs.py - get_run_status endpoint

if previous_status != RunStatus.ACTIVE and status_value == RunStatus.ACTIVE:
    from celery_app.tasks.pod_tasks import on_pod_ready
    on_pod_ready.delay(run_id)
```

## Running the Workers

### Development

**Important**: The `PYTHONPATH=.` prefix is required so Celery workers can import modules like `database`, `services`, etc.

```bash
# Terminal 1: FastAPI server
cd apps/api
uv run uvicorn main:app --reload --port 8000

# Terminal 2: Celery worker (PYTHONPATH=. is required!)
cd apps/api
PYTHONPATH=. uv run celery -A celery_app worker --loglevel=info -Q pod_ops,repo_ops

# Terminal 3: Celery beat (scheduler)
cd apps/api
PYTHONPATH=. uv run celery -A celery_app beat --loglevel=info
```

### Production

Use separate containers/processes for each component:

```bash
# Worker (set PYTHONPATH in container environment)
PYTHONPATH=/app celery -A celery_app worker --loglevel=info -Q pod_ops,repo_ops --concurrency=4

# Beat scheduler
PYTHONPATH=/app celery -A celery_app beat --loglevel=info
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379/0` |
| `CELERY_TASK_TIMEOUT` | Default task timeout (seconds) | `3600` |
| `CELERY_CLONE_TIMEOUT` | Clone task timeout (seconds) | `600` |
| `CELERY_COMMAND_TIMEOUT` | General command timeout (seconds) | `300` |
| `CELERY_MAX_RETRIES` | Maximum retry attempts | `3` |
| `CELERY_RETRY_DELAY` | Delay between retries (seconds) | `60` |
| `CELERY_JOB_CHECK_INTERVAL` | Pending job check interval (seconds) | `30` |

### Redis Cloud Connection

For Redis Cloud with TLS:

```bash
REDIS_URL=rediss://default:password@redis-xxxxx.c1.region.cloud.redislabs.com:xxxxx/0
```

Note: Use `rediss://` (with double 's') for TLS connections.

## Error Handling

### Retry Strategy

Tasks use exponential backoff with jitter:

- Default retry delay: 60 seconds
- Maximum retries: 3
- Backoff multiplier: 2x per retry

### Error Types

| Error Type | Description | Retryable |
|------------|-------------|-----------|
| `ssh_error` | SSH connection failed | Yes |
| `timeout` | Command timed out | Yes |
| `command_error` | Non-zero exit code | Depends |
| `clone_error` | Git clone failed | Yes |
| `list_error` | File listing failed | Yes |
| `unknown` | Unexpected error | Yes |

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `Permission denied for user root` | SSH key not provisioned to pod | Ensure user has SSH key configured; we now explicitly pass `sshKeyId` when creating pods |
| `Event loop is closed` | Multiple `run_async()` calls with same executor | Wrap all async ops in single async function |
| `No such file or directory: /workspace` | Directory doesn't exist on pod | Clone task now auto-creates parent directories |
| `ModuleNotFoundError: No module named 'database'` | Missing PYTHONPATH | Run worker with `PYTHONPATH=.` prefix |
| `No SSH key found` | User tried to create run without SSH key | Generate SSH key in Settings before creating runs |

### Dead Letter Queue

Failed tasks after all retries are logged and the job status is set to `FAILED`. The error details are stored in:

- `job.error_message`: Human-readable error
- `job.error_type`: Error category
- `job_commands.stderr`: Command error output

## Monitoring

### Flower (Celery Monitoring)

```bash
# Install
uv add flower

# Run
uv run celery -A celery_app flower --port=5555
```

Access at http://localhost:5555 for:
- Active workers and their status
- Task progress and history
- Queue lengths
- Task success/failure rates

## Adding New Job Types

1. Add the type to `JobType` enum in `database.py`:

```python
class JobType(StrEnum):
    CLONE_REPO = "CLONE_REPO"
    LIST_FILES = "LIST_FILES"
    CUSTOM_COMMAND = "CUSTOM_COMMAND"
    INSTALL_DEPS = "INSTALL_DEPS"  # New type
```

2. Create the task in `celery_app/tasks/repo_tasks.py`:

```python
@celery_app.task(bind=True, base=DatabaseTask, max_retries=3)
def install_dependencies(self, job_id: int):
    # Implementation
    pass
```

3. Register in `celery_app/tasks/pod_tasks.py`:

```python
if job.job_type == "INSTALL_DEPS":
    from celery_app.tasks.repo_tasks import install_dependencies
    task = install_dependencies.delay(job.id)
```

4. Export in `celery_app/tasks/__init__.py`:

```python
from celery_app.tasks.repo_tasks import install_dependencies
```

## Security Considerations

1. **SSH Keys**: 
   - Private keys are stored in AWS Secrets Manager and fetched on-demand
   - Public keys are uploaded to Prime Intellect and must be set as **primary** to be provisioned to new pods
   - Keys are generated client-side in OpenSSH Ed25519 format
2. **Redis TLS**: Use `rediss://` URLs for encrypted connections
3. **Command Validation**: Validate job configs before execution
4. **User Isolation**: Jobs are scoped to `clerk_user_id` and verified on all operations

## SSH Key Flow

For jobs to execute successfully, the following must be in place:

1. **Key Generation**: User generates Ed25519 key pair in the frontend
2. **Upload**: Public key uploaded to Prime Intellect, private key stored in AWS Secrets Manager
3. **Pod Creation**: When creating a run, the `sshKeyId` is explicitly passed to Prime Intellect (see below)
4. **Pod Provisioning**: The pod is created with the specified SSH key
5. **Job Execution**: Celery worker retrieves private key from AWS and connects to pod

### Explicit SSH Key Assignment

When creating a pod, we explicitly pass the user's SSH key ID rather than relying on the "primary" key mechanism:

```python
# In routers/runs.py - create_run endpoint
ssh_key = await db.execute(
    select(UserSshKey).where(UserSshKey.clerk_user_id == clerk_user_id)
)

pod_payload = {
    "name": body.name,
    "cloudId": body.instance.cloud_id,
    # ... other fields ...
    "sshKeyId": ssh_key.prime_ssh_key_id,  # Explicitly set SSH key
}
```

This ensures reliable SSH key provisioning. Users must have an SSH key configured before creating runs.

**Note**: Existing pods will NOT be updated if you change SSH keys. You must terminate and create new runs to use a different key.
