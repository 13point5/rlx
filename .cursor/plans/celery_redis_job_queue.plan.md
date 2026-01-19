---
name: Celery Redis Job Queue
overview: Implement a job queue system using Redis Cloud and Celery for executing commands on GPU pods (like cloning repos and listing files). Jobs start automatically when pods are ready and execute independently of client polling.
todos:
  - id: dependencies
    content: Add Celery, Redis, and related dependencies to apps/api using uv
    status: pending
  - id: celery-config
    content: Create Celery configuration module with Redis Cloud as broker/backend
    status: pending
  - id: command-executor
    content: Create CommandExecutor abstraction for running commands with stdout/stderr/exit_code
    status: pending
  - id: database-models
    content: Add Job and JobCommand models to database.py with migrations
    status: pending
  - id: celery-tasks
    content: Create Celery tasks module with base task and specific job implementations
    status: pending
  - id: job-router
    content: Add jobs router with endpoints to create, list, and get job status
    status: pending
  - id: pod-ready-hook
    content: Integrate job queue with pod status polling to trigger jobs when ACTIVE
    status: pending
  - id: repo-clone-task
    content: Implement repo clone task using CommandExecutor
    status: pending
  - id: list-files-task
    content: Implement list files task to return root directory contents
    status: pending
---

# Celery Redis Job Queue Implementation Plan

## Executive Summary

This document outlines the implementation of a distributed job queue system using **Celery** with **Redis Cloud** as the message broker and result backend. The system enables executing commands on GPU pods asynchronously, starting with repo cloning and file listing operations.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              RLX Architecture                                    │
└─────────────────────────────────────────────────────────────────────────────────┘

                                 ┌─────────────────┐
                                 │   Redis Cloud   │
                                 │  (Job Broker &  │
                                 │  Result Store)  │
                                 └────────┬────────┘
                                          │
              ┌───────────────────────────┼───────────────────────────┐
              │                           │                           │
              ▼                           ▼                           ▼
     ┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
     │  FastAPI Server │         │  Celery Worker  │         │  Celery Beat    │
     │  (Producer)     │────────▶│  (Consumer)     │         │  (Scheduler)    │
     │                 │         │                 │         │                 │
     │ - REST API      │         │ - Execute jobs  │         │ - Poll pod      │
     │ - Submit jobs   │         │ - SSH to pods   │         │   status        │
     │ - Query status  │         │ - Run commands  │         │ - Auto-start    │
     └─────────────────┘         └────────┬────────┘         │   jobs          │
              │                           │                   └─────────────────┘
              │                           │
              ▼                           ▼
     ┌─────────────────┐         ┌─────────────────┐
     │   PostgreSQL    │         │   GPU Pod       │
     │   (Job State)   │         │ (Prime Intellect)│
     │                 │         │                 │
     │ - Job metadata  │         │ - SSH access    │
     │ - Command log   │         │ - Execute cmds  │
     │ - Run linkage   │         │ - Clone repos   │
     └─────────────────┘         └─────────────────┘
```

## Why Redis Cloud + Celery?

### Redis Cloud Benefits
1. **Managed Service**: No infrastructure management, automatic failover
2. **High Availability**: Multi-zone replication for production
3. **Scalability**: Handles thousands of messages per second
4. **Persistence**: RDB/AOF persistence for message durability
5. **TLS Support**: Secure connections out of the box

### Celery Benefits
1. **Battle-tested**: Widely used in production Python applications
2. **Flexible**: Supports multiple broker backends (easy to swap if needed)
3. **Task Routing**: Route different tasks to different workers
4. **Retry Logic**: Built-in exponential backoff and dead letter queues
5. **Monitoring**: Integration with Flower for real-time monitoring
6. **Async Support**: Can work with async Python code
7. **Result Backend**: Store task results with configurable TTL

### Best Practices from Official Documentation

Based on Celery 5.x documentation and Redis best practices:

1. **Task Idempotency**: Tasks should be idempotent to handle retries safely
2. **Task Granularity**: Keep tasks focused on single operations
3. **Result Expiry**: Set `result_expires` to avoid Redis memory bloat
4. **Visibility Timeout**: Configure `visibility_timeout` > task duration
5. **Prefetch Limit**: Use `worker_prefetch_multiplier=1` for long tasks
6. **Acks Late**: Enable `task_acks_late=True` for at-least-once delivery
7. **Connection Pooling**: Use `broker_pool_limit` for connection reuse
8. **Serialization**: Use JSON serialization for cross-language compatibility

## Command Executor Abstraction

### Design Principles

The `CommandExecutor` abstraction provides:
1. **Unified interface** for executing commands locally or remotely
2. **Structured output** with stdout, stderr, exit code, and timing
3. **Timeout handling** with configurable limits
4. **Error categorization** for different failure modes
5. **Streaming support** for long-running commands
6. **Extensibility** for adding new command types

### CommandResult Dataclass

```python
from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Any


class CommandStatus(StrEnum):
    """Status of command execution."""
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    TIMEOUT = "TIMEOUT"
    CANCELLED = "CANCELLED"


@dataclass
class CommandResult:
    """Result of a command execution."""
    
    # Core fields
    stdout: str = ""
    stderr: str = ""
    exit_code: int | None = None
    status: CommandStatus = CommandStatus.PENDING
    
    # Timing
    started_at: datetime | None = None
    completed_at: datetime | None = None
    duration_ms: int | None = None
    
    # Error context
    error_message: str | None = None
    error_type: str | None = None  # "timeout", "ssh_error", "command_error", etc.
    
    # Metadata
    command: str = ""
    working_dir: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)
    
    @property
    def success(self) -> bool:
        return self.status == CommandStatus.SUCCESS and self.exit_code == 0
```

### CommandExecutor Interface

```python
from abc import ABC, abstractmethod
from typing import AsyncGenerator


class CommandExecutor(ABC):
    """Base class for command executors."""
    
    @abstractmethod
    async def execute(
        self,
        command: str,
        *,
        working_dir: str | None = None,
        timeout_seconds: int = 300,
        env: dict[str, str] | None = None,
    ) -> CommandResult:
        """Execute a command and return the result."""
        pass
    
    @abstractmethod
    async def execute_streaming(
        self,
        command: str,
        *,
        working_dir: str | None = None,
        timeout_seconds: int = 300,
        env: dict[str, str] | None = None,
    ) -> AsyncGenerator[str, None]:
        """Execute a command and yield output as it streams."""
        pass
    
    @abstractmethod
    async def is_available(self) -> bool:
        """Check if the executor is available (e.g., SSH connection works)."""
        pass


class SSHCommandExecutor(CommandExecutor):
    """Execute commands on remote host via SSH."""
    
    def __init__(
        self,
        host: str,
        port: int = 22,
        username: str = "root",
        private_key: str | None = None,
        private_key_path: str | None = None,
    ):
        self.host = host
        self.port = port
        self.username = username
        self.private_key = private_key
        self.private_key_path = private_key_path
        
    async def execute(self, command: str, **kwargs) -> CommandResult:
        # Implementation using asyncssh
        pass


class LocalCommandExecutor(CommandExecutor):
    """Execute commands locally (for testing/development)."""
    
    async def execute(self, command: str, **kwargs) -> CommandResult:
        # Implementation using asyncio.subprocess
        pass
```

## Database Schema

### New Models

```python
# Add to apps/api/database.py

class JobStatus(StrEnum):
    """Status values for jobs."""
    PENDING = "PENDING"       # Waiting for pod to be ready
    QUEUED = "QUEUED"         # In Celery queue
    RUNNING = "RUNNING"       # Currently executing
    SUCCESS = "SUCCESS"       # Completed successfully
    FAILED = "FAILED"         # Execution failed
    TIMEOUT = "TIMEOUT"       # Timed out
    CANCELLED = "CANCELLED"   # Cancelled by user


class JobType(StrEnum):
    """Types of jobs."""
    CLONE_REPO = "CLONE_REPO"
    LIST_FILES = "LIST_FILES"
    CUSTOM_COMMAND = "CUSTOM_COMMAND"


class Job(Base):
    """
    Represents a job to be executed on a pod.
    Jobs are created when a run is created and executed when the pod becomes ACTIVE.
    """
    __tablename__ = "jobs"
    
    id = Column(Integer, primary_key=True)
    run_id = Column(Integer, ForeignKey("runs.id"), nullable=False, index=True)
    clerk_user_id = Column(String, nullable=False, index=True)
    
    # Job type and configuration
    job_type = Column(String, nullable=False)  # JobType enum value
    job_config = Column(JSON, nullable=False, default=dict)  # Type-specific config
    
    # Celery task tracking
    celery_task_id = Column(String, nullable=True, index=True)
    
    # Status
    status = Column(String, nullable=False, default=JobStatus.PENDING)
    
    # Execution order within a run
    sequence = Column(Integer, nullable=False, default=0)
    
    # Timing
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Error info
    error_message = Column(Text, nullable=True)
    error_type = Column(String, nullable=True)


class JobCommand(Base):
    """
    Records each command executed as part of a job.
    Provides detailed logging of what was run and the results.
    """
    __tablename__ = "job_commands"
    
    id = Column(Integer, primary_key=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False, index=True)
    
    # Command details
    command = Column(Text, nullable=False)
    working_dir = Column(String, nullable=True)
    
    # Results
    stdout = Column(Text, nullable=True)
    stderr = Column(Text, nullable=True)
    exit_code = Column(Integer, nullable=True)
    status = Column(String, nullable=False, default=CommandStatus.PENDING)
    
    # Timing
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    duration_ms = Column(Integer, nullable=True)
    
    # Sequence within job
    sequence = Column(Integer, nullable=False, default=0)
```

### Migration

```python
# alembic/versions/xxxx_add_jobs_tables.py

def upgrade():
    op.create_table(
        'jobs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('run_id', sa.Integer(), nullable=False),
        sa.Column('clerk_user_id', sa.String(), nullable=False),
        sa.Column('job_type', sa.String(), nullable=False),
        sa.Column('job_config', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('celery_task_id', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='PENDING'),
        sa.Column('sequence', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('error_type', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['run_id'], ['runs.id']),
    )
    op.create_index('ix_jobs_run_id', 'jobs', ['run_id'])
    op.create_index('ix_jobs_clerk_user_id', 'jobs', ['clerk_user_id'])
    op.create_index('ix_jobs_celery_task_id', 'jobs', ['celery_task_id'])
    op.create_index('ix_jobs_status', 'jobs', ['status'])
    
    op.create_table(
        'job_commands',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('job_id', sa.Integer(), nullable=False),
        sa.Column('command', sa.Text(), nullable=False),
        sa.Column('working_dir', sa.String(), nullable=True),
        sa.Column('stdout', sa.Text(), nullable=True),
        sa.Column('stderr', sa.Text(), nullable=True),
        sa.Column('exit_code', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='PENDING'),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('duration_ms', sa.Integer(), nullable=True),
        sa.Column('sequence', sa.Integer(), nullable=False, server_default='0'),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['job_id'], ['jobs.id']),
    )
    op.create_index('ix_job_commands_job_id', 'job_commands', ['job_id'])
```

## Celery Configuration

### Directory Structure

```
apps/api/
├── celery_app/
│   ├── __init__.py          # Celery app instance
│   ├── config.py            # Celery configuration
│   ├── tasks/
│   │   ├── __init__.py      # Task exports
│   │   ├── base.py          # Base task class
│   │   ├── pod_tasks.py     # Pod-related tasks
│   │   └── repo_tasks.py    # Repository tasks
│   └── executors/
│       ├── __init__.py
│       ├── base.py          # CommandExecutor base
│       ├── ssh.py           # SSH executor
│       └── local.py         # Local executor (testing)
├── ...
```

### Celery App Configuration

```python
# apps/api/celery_app/__init__.py

import os
from celery import Celery
from dotenv import load_dotenv

load_dotenv()

def make_celery():
    """Create and configure the Celery application."""
    
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    
    app = Celery(
        "rlx",
        broker=redis_url,
        backend=redis_url,
        include=[
            "celery_app.tasks.pod_tasks",
            "celery_app.tasks.repo_tasks",
        ],
    )
    
    # Celery configuration
    app.conf.update(
        # Serialization
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",
        
        # Timezone
        timezone="UTC",
        enable_utc=True,
        
        # Task execution
        task_acks_late=True,  # Acknowledge after task completes
        task_reject_on_worker_lost=True,  # Re-queue if worker dies
        worker_prefetch_multiplier=1,  # Fetch one task at a time (for long tasks)
        
        # Results
        result_expires=86400,  # Results expire after 24 hours
        result_extended=True,  # Store additional metadata
        
        # Broker settings (Redis-specific)
        broker_connection_retry_on_startup=True,
        broker_transport_options={
            "visibility_timeout": 3600,  # 1 hour (for long-running tasks)
            "fanout_prefix": True,
            "fanout_patterns": True,
        },
        
        # Retry policy
        task_default_retry_delay=60,  # 1 minute
        task_max_retries=3,
        
        # Task routing
        task_routes={
            "celery_app.tasks.pod_tasks.*": {"queue": "pod_ops"},
            "celery_app.tasks.repo_tasks.*": {"queue": "repo_ops"},
        },
        
        # Beat schedule (periodic tasks)
        beat_schedule={
            "check-pending-jobs": {
                "task": "celery_app.tasks.pod_tasks.check_pending_jobs",
                "schedule": 30.0,  # Every 30 seconds
            },
        },
    )
    
    return app


celery_app = make_celery()
```

### Config Module

```python
# apps/api/celery_app/config.py

import os
from pydantic_settings import BaseSettings


class CelerySettings(BaseSettings):
    """Celery configuration settings."""
    
    # Redis connection
    redis_url: str = "redis://localhost:6379/0"
    redis_ssl: bool = False
    redis_ssl_cert_reqs: str = "required"
    
    # Task settings
    task_timeout: int = 3600  # 1 hour default
    clone_timeout: int = 600  # 10 minutes for clone
    command_timeout: int = 300  # 5 minutes for general commands
    
    # Retry settings
    max_retries: int = 3
    retry_delay: int = 60
    
    # Worker settings
    worker_concurrency: int = 4
    
    class Config:
        env_prefix = "CELERY_"


settings = CelerySettings()
```

## Task Implementations

### Base Task Class

```python
# apps/api/celery_app/tasks/base.py

import logging
from datetime import datetime, timezone
from celery import Task
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import DATABASE_URL

logger = logging.getLogger(__name__)


class DatabaseTask(Task):
    """
    Base task class that provides database session management.
    Uses sync SQLAlchemy since Celery tasks run in separate processes.
    """
    
    _db_engine = None
    _Session = None
    
    @property
    def db_engine(self):
        if self._db_engine is None:
            # Convert async URL to sync URL
            sync_url = DATABASE_URL.replace("postgresql+asyncpg", "postgresql")
            self._db_engine = create_engine(sync_url)
        return self._db_engine
    
    @property
    def Session(self):
        if self._Session is None:
            self._Session = sessionmaker(bind=self.db_engine)
        return self._Session
    
    def get_db_session(self):
        return self.Session()
    
    def update_job_status(self, job_id: int, status: str, **kwargs):
        """Update job status in database."""
        with self.get_db_session() as session:
            from database import Job
            job = session.query(Job).filter(Job.id == job_id).first()
            if job:
                job.status = status
                for key, value in kwargs.items():
                    if hasattr(job, key):
                        setattr(job, key, value)
                session.commit()
                logger.info(f"Updated job {job_id} status to {status}")
```

### Pod Tasks

```python
# apps/api/celery_app/tasks/pod_tasks.py

import logging
from datetime import datetime, timezone

from celery_app import celery_app
from celery_app.tasks.base import DatabaseTask
from database import Job, Run, JobStatus, RunStatus

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, base=DatabaseTask)
def check_pending_jobs(self):
    """
    Periodic task that checks for pending jobs and starts them when pods are ready.
    This runs every 30 seconds via Celery Beat.
    """
    with self.get_db_session() as session:
        # Find all pending jobs where the associated run is ACTIVE
        pending_jobs = (
            session.query(Job)
            .join(Run, Job.run_id == Run.id)
            .filter(
                Job.status == JobStatus.PENDING,
                Run.status == RunStatus.ACTIVE,
            )
            .order_by(Job.sequence)
            .all()
        )
        
        for job in pending_jobs:
            logger.info(f"Starting job {job.id} (type: {job.job_type}) for run {job.run_id}")
            
            # Queue the appropriate task based on job type
            task = None
            if job.job_type == "CLONE_REPO":
                from celery_app.tasks.repo_tasks import clone_repository
                task = clone_repository.delay(job.id)
            elif job.job_type == "LIST_FILES":
                from celery_app.tasks.repo_tasks import list_files
                task = list_files.delay(job.id)
            elif job.job_type == "CUSTOM_COMMAND":
                from celery_app.tasks.repo_tasks import run_custom_command
                task = run_custom_command.delay(job.id)
            
            if task:
                job.status = JobStatus.QUEUED
                job.celery_task_id = task.id
                session.commit()
                
        return {"checked": len(pending_jobs), "queued": len(pending_jobs)}


@celery_app.task(bind=True, base=DatabaseTask, max_retries=3)
def on_pod_ready(self, run_id: int):
    """
    Called when a pod transitions to ACTIVE status.
    This triggers any pending jobs for that run.
    """
    logger.info(f"Pod ready for run {run_id}, checking for pending jobs")
    
    with self.get_db_session() as session:
        pending_jobs = (
            session.query(Job)
            .filter(
                Job.run_id == run_id,
                Job.status == JobStatus.PENDING,
            )
            .order_by(Job.sequence)
            .all()
        )
        
        for job in pending_jobs:
            check_pending_jobs.delay()  # Trigger job processing
            break  # Only need to trigger once
            
    return {"run_id": run_id, "pending_jobs": len(pending_jobs)}
```

### Repository Tasks

```python
# apps/api/celery_app/tasks/repo_tasks.py

import logging
from datetime import datetime, timezone

from celery_app import celery_app
from celery_app.tasks.base import DatabaseTask
from celery_app.executors.ssh import SSHCommandExecutor
from database import Job, JobCommand, Run, Project, UserSshKey, JobStatus, CommandStatus
from services.aws_secrets_manager import get_private_key_secret

logger = logging.getLogger(__name__)


async def get_executor_for_run(session, run_id: int) -> SSHCommandExecutor | None:
    """
    Create an SSH executor for the given run.
    Retrieves SSH connection details and private key.
    """
    run = session.query(Run).filter(Run.id == run_id).first()
    if not run:
        return None
    
    # Get SSH key for user
    ssh_key = (
        session.query(UserSshKey)
        .filter(UserSshKey.clerk_user_id == run.clerk_user_id)
        .first()
    )
    if not ssh_key:
        raise ValueError(f"No SSH key found for user {run.clerk_user_id}")
    
    # Get private key from AWS Secrets Manager
    private_key = get_private_key_secret(ssh_key.aws_secret_arn)
    
    # Parse SSH connection string (format: "root@ip -p port")
    # This is a simplified parser - real implementation needs to handle variations
    ssh_info = run.ssh_connection  # We need to add this field to Run model
    # Parse host and port from ssh_connection
    
    return SSHCommandExecutor(
        host=run.ip,  # We need to add this field to Run model
        port=22,
        username="root",
        private_key=private_key,
    )


@celery_app.task(bind=True, base=DatabaseTask, max_retries=3, default_retry_delay=60)
def clone_repository(self, job_id: int):
    """
    Clone a repository to the pod.
    
    Job config:
    {
        "repo_url": "https://github.com/owner/repo.git",
        "branch": "main",
        "target_dir": "/workspace/repo",
        "depth": 1  # Optional: shallow clone
    }
    """
    logger.info(f"Starting clone_repository task for job {job_id}")
    
    with self.get_db_session() as session:
        job = session.query(Job).filter(Job.id == job_id).first()
        if not job:
            logger.error(f"Job {job_id} not found")
            return {"error": "Job not found"}
        
        # Update job status to RUNNING
        job.status = JobStatus.RUNNING
        job.started_at = datetime.now(timezone.utc)
        session.commit()
        
        try:
            config = job.job_config
            repo_url = config["repo_url"]
            branch = config.get("branch", "main")
            target_dir = config.get("target_dir", "/workspace/repo")
            depth = config.get("depth")
            
            # Build clone command
            clone_cmd = f"git clone"
            if depth:
                clone_cmd += f" --depth {depth}"
            if branch:
                clone_cmd += f" --branch {branch}"
            clone_cmd += f" {repo_url} {target_dir}"
            
            # Get executor
            run = session.query(Run).filter(Run.id == job.run_id).first()
            # Note: In real implementation, we'd get SSH details from run status
            
            # Record command
            cmd_record = JobCommand(
                job_id=job_id,
                command=clone_cmd,
                working_dir="/workspace",
                status=CommandStatus.RUNNING,
                started_at=datetime.now(timezone.utc),
                sequence=0,
            )
            session.add(cmd_record)
            session.commit()
            
            # Execute command (placeholder - real impl uses SSHCommandExecutor)
            # result = await executor.execute(clone_cmd, timeout_seconds=600)
            
            # For now, simulate success
            cmd_record.status = CommandStatus.SUCCESS
            cmd_record.exit_code = 0
            cmd_record.stdout = f"Cloned {repo_url} to {target_dir}"
            cmd_record.completed_at = datetime.now(timezone.utc)
            cmd_record.duration_ms = 5000
            
            job.status = JobStatus.SUCCESS
            job.completed_at = datetime.now(timezone.utc)
            session.commit()
            
            logger.info(f"Job {job_id} completed successfully")
            return {
                "job_id": job_id,
                "status": "success",
                "repo": repo_url,
                "target_dir": target_dir,
            }
            
        except Exception as e:
            logger.exception(f"Job {job_id} failed: {e}")
            job.status = JobStatus.FAILED
            job.error_message = str(e)
            job.error_type = type(e).__name__
            job.completed_at = datetime.now(timezone.utc)
            session.commit()
            
            # Retry with exponential backoff
            raise self.retry(exc=e)


@celery_app.task(bind=True, base=DatabaseTask, max_retries=3)
def list_files(self, job_id: int):
    """
    List files and folders in the root of the cloned repository.
    
    Job config:
    {
        "target_dir": "/workspace/repo"
    }
    
    Returns:
    {
        "files": ["file1.py", "file2.txt"],
        "directories": ["src", "tests", "docs"]
    }
    """
    logger.info(f"Starting list_files task for job {job_id}")
    
    with self.get_db_session() as session:
        job = session.query(Job).filter(Job.id == job_id).first()
        if not job:
            return {"error": "Job not found"}
        
        job.status = JobStatus.RUNNING
        job.started_at = datetime.now(timezone.utc)
        session.commit()
        
        try:
            config = job.job_config
            target_dir = config.get("target_dir", "/workspace/repo")
            
            # Command to list files with type indicator
            # -1: one per line, -p: append / to directories, -A: show hidden except . and ..
            list_cmd = f"ls -1Ap {target_dir}"
            
            cmd_record = JobCommand(
                job_id=job_id,
                command=list_cmd,
                working_dir=target_dir,
                status=CommandStatus.RUNNING,
                started_at=datetime.now(timezone.utc),
                sequence=0,
            )
            session.add(cmd_record)
            session.commit()
            
            # Execute command (placeholder)
            # result = await executor.execute(list_cmd)
            
            # Parse output to separate files and directories
            # Lines ending with / are directories
            # output_lines = result.stdout.strip().split('\n')
            # files = [l for l in output_lines if not l.endswith('/')]
            # directories = [l.rstrip('/') for l in output_lines if l.endswith('/')]
            
            # Simulated result
            files = ["README.md", "requirements.txt", "main.py", ".gitignore"]
            directories = ["src", "tests", "docs", ".git"]
            
            cmd_record.status = CommandStatus.SUCCESS
            cmd_record.exit_code = 0
            cmd_record.stdout = "\n".join(files + [d + "/" for d in directories])
            cmd_record.completed_at = datetime.now(timezone.utc)
            cmd_record.duration_ms = 100
            
            job.status = JobStatus.SUCCESS
            job.completed_at = datetime.now(timezone.utc)
            
            # Store result in job config for easy retrieval
            job.job_config = {
                **config,
                "result": {
                    "files": files,
                    "directories": directories,
                }
            }
            session.commit()
            
            return {
                "job_id": job_id,
                "files": files,
                "directories": directories,
            }
            
        except Exception as e:
            logger.exception(f"Job {job_id} failed: {e}")
            job.status = JobStatus.FAILED
            job.error_message = str(e)
            job.completed_at = datetime.now(timezone.utc)
            session.commit()
            raise self.retry(exc=e)


@celery_app.task(bind=True, base=DatabaseTask, max_retries=2)
def run_custom_command(self, job_id: int):
    """
    Run a custom command on the pod.
    
    Job config:
    {
        "command": "pip install -r requirements.txt",
        "working_dir": "/workspace/repo",
        "timeout_seconds": 300,
        "env": {"KEY": "value"}  # Optional environment variables
    }
    """
    logger.info(f"Starting custom command task for job {job_id}")
    
    with self.get_db_session() as session:
        job = session.query(Job).filter(Job.id == job_id).first()
        if not job:
            return {"error": "Job not found"}
        
        job.status = JobStatus.RUNNING
        job.started_at = datetime.now(timezone.utc)
        session.commit()
        
        try:
            config = job.job_config
            command = config["command"]
            working_dir = config.get("working_dir", "/workspace")
            timeout = config.get("timeout_seconds", 300)
            
            cmd_record = JobCommand(
                job_id=job_id,
                command=command,
                working_dir=working_dir,
                status=CommandStatus.RUNNING,
                started_at=datetime.now(timezone.utc),
                sequence=0,
            )
            session.add(cmd_record)
            session.commit()
            
            # Execute command
            # result = await executor.execute(command, working_dir=working_dir, timeout_seconds=timeout)
            
            cmd_record.status = CommandStatus.SUCCESS
            cmd_record.exit_code = 0
            cmd_record.completed_at = datetime.now(timezone.utc)
            
            job.status = JobStatus.SUCCESS
            job.completed_at = datetime.now(timezone.utc)
            session.commit()
            
            return {
                "job_id": job_id,
                "status": "success",
                "exit_code": 0,
            }
            
        except Exception as e:
            job.status = JobStatus.FAILED
            job.error_message = str(e)
            job.completed_at = datetime.now(timezone.utc)
            session.commit()
            raise
```

## SSH Command Executor Implementation

```python
# apps/api/celery_app/executors/ssh.py

import asyncio
import logging
from datetime import datetime, timezone
from typing import AsyncGenerator

import asyncssh

from celery_app.executors.base import CommandExecutor, CommandResult, CommandStatus

logger = logging.getLogger(__name__)


class SSHCommandExecutor(CommandExecutor):
    """Execute commands on remote host via SSH using asyncssh."""
    
    def __init__(
        self,
        host: str,
        port: int = 22,
        username: str = "root",
        private_key: str | None = None,
        private_key_path: str | None = None,
        known_hosts: str | None = None,
    ):
        self.host = host
        self.port = port
        self.username = username
        self.private_key = private_key
        self.private_key_path = private_key_path
        self.known_hosts = known_hosts
        self._connection = None
    
    async def _get_connection(self) -> asyncssh.SSHClientConnection:
        """Get or create SSH connection."""
        if self._connection is None or self._connection.is_closed():
            connect_args = {
                "host": self.host,
                "port": self.port,
                "username": self.username,
                "known_hosts": None,  # Disable host key checking for now
            }
            
            if self.private_key:
                # Load key from string
                connect_args["client_keys"] = [asyncssh.import_private_key(self.private_key)]
            elif self.private_key_path:
                connect_args["client_keys"] = [self.private_key_path]
            
            self._connection = await asyncssh.connect(**connect_args)
        
        return self._connection
    
    async def execute(
        self,
        command: str,
        *,
        working_dir: str | None = None,
        timeout_seconds: int = 300,
        env: dict[str, str] | None = None,
    ) -> CommandResult:
        """Execute a command and return the result."""
        result = CommandResult(
            command=command,
            working_dir=working_dir,
            started_at=datetime.now(timezone.utc),
            status=CommandStatus.RUNNING,
        )
        
        try:
            conn = await self._get_connection()
            
            # Build full command with working directory
            full_command = command
            if working_dir:
                full_command = f"cd {working_dir} && {command}"
            
            # Add environment variables if provided
            if env:
                env_prefix = " ".join(f"{k}={v}" for k, v in env.items())
                full_command = f"{env_prefix} {full_command}"
            
            # Execute with timeout
            try:
                ssh_result = await asyncio.wait_for(
                    conn.run(full_command, check=False),
                    timeout=timeout_seconds,
                )
                
                result.stdout = ssh_result.stdout or ""
                result.stderr = ssh_result.stderr or ""
                result.exit_code = ssh_result.returncode
                result.status = (
                    CommandStatus.SUCCESS if ssh_result.returncode == 0 
                    else CommandStatus.FAILED
                )
                
            except asyncio.TimeoutError:
                result.status = CommandStatus.TIMEOUT
                result.error_message = f"Command timed out after {timeout_seconds} seconds"
                result.error_type = "timeout"
                
        except asyncssh.Error as e:
            result.status = CommandStatus.FAILED
            result.error_message = str(e)
            result.error_type = "ssh_error"
            logger.exception(f"SSH error executing command: {e}")
            
        except Exception as e:
            result.status = CommandStatus.FAILED
            result.error_message = str(e)
            result.error_type = "unknown"
            logger.exception(f"Error executing command: {e}")
            
        finally:
            result.completed_at = datetime.now(timezone.utc)
            if result.started_at and result.completed_at:
                result.duration_ms = int(
                    (result.completed_at - result.started_at).total_seconds() * 1000
                )
        
        return result
    
    async def execute_streaming(
        self,
        command: str,
        *,
        working_dir: str | None = None,
        timeout_seconds: int = 300,
        env: dict[str, str] | None = None,
    ) -> AsyncGenerator[str, None]:
        """Execute a command and yield output as it streams."""
        conn = await self._get_connection()
        
        full_command = command
        if working_dir:
            full_command = f"cd {working_dir} && {command}"
        if env:
            env_prefix = " ".join(f"{k}={v}" for k, v in env.items())
            full_command = f"{env_prefix} {full_command}"
        
        async with conn.create_process(full_command) as process:
            async for line in process.stdout:
                yield line
    
    async def is_available(self) -> bool:
        """Check if SSH connection is available."""
        try:
            conn = await self._get_connection()
            result = await conn.run("echo ok", check=True)
            return result.returncode == 0
        except Exception as e:
            logger.warning(f"SSH connection check failed: {e}")
            return False
    
    async def close(self):
        """Close the SSH connection."""
        if self._connection:
            self._connection.close()
            await self._connection.wait_closed()
            self._connection = None
```

## API Router

```python
# apps/api/routers/jobs.py

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from database import Job, JobCommand, Run, JobStatus, JobType
from deps import CurrentUser, DbSession

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


class JobConfig(BaseModel):
    """Base job configuration."""
    pass


class CloneRepoConfig(JobConfig):
    repo_url: str
    branch: str = "main"
    target_dir: str = "/workspace/repo"
    depth: int | None = None


class ListFilesConfig(JobConfig):
    target_dir: str = "/workspace/repo"


class CustomCommandConfig(JobConfig):
    command: str
    working_dir: str = "/workspace"
    timeout_seconds: int = 300
    env: dict[str, str] | None = None


class CreateJobRequest(BaseModel):
    run_id: int
    job_type: str  # JobType value
    config: dict[str, Any]


class JobResponse(BaseModel):
    id: int
    run_id: int
    job_type: str
    status: str
    config: dict[str, Any]
    celery_task_id: str | None
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None
    error_message: str | None
    
    class Config:
        from_attributes = True


class JobCommandResponse(BaseModel):
    id: int
    command: str
    working_dir: str | None
    stdout: str | None
    stderr: str | None
    exit_code: int | None
    status: str
    started_at: datetime | None
    completed_at: datetime | None
    duration_ms: int | None
    
    class Config:
        from_attributes = True


class JobDetailResponse(JobResponse):
    commands: list[JobCommandResponse]


@router.post("", status_code=status.HTTP_201_CREATED, response_model=JobResponse)
async def create_job(body: CreateJobRequest, user: CurrentUser, db: DbSession):
    """
    Create a new job for a run.
    Job will start automatically when the pod is ready.
    """
    clerk_user_id = user.get("sub")
    
    # Verify run exists and belongs to user
    result = await db.execute(
        select(Run).where(Run.id == body.run_id, Run.clerk_user_id == clerk_user_id)
    )
    run = result.scalar_one_or_none()
    
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Run not found",
        )
    
    # Validate job type
    if body.job_type not in [e.value for e in JobType]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid job type. Must be one of: {[e.value for e in JobType]}",
        )
    
    # Get next sequence number
    seq_result = await db.execute(
        select(Job.sequence)
        .where(Job.run_id == body.run_id)
        .order_by(Job.sequence.desc())
        .limit(1)
    )
    last_seq = seq_result.scalar_one_or_none() or -1
    
    job = Job(
        run_id=body.run_id,
        clerk_user_id=clerk_user_id,
        job_type=body.job_type,
        job_config=body.config,
        status=JobStatus.PENDING,
        sequence=last_seq + 1,
    )
    
    db.add(job)
    await db.commit()
    await db.refresh(job)
    
    return job


@router.get("", response_model=list[JobResponse])
async def list_jobs(
    user: CurrentUser,
    db: DbSession,
    run_id: int | None = None,
    status: str | None = None,
):
    """List jobs for the current user, optionally filtered by run or status."""
    clerk_user_id = user.get("sub")
    
    query = select(Job).where(Job.clerk_user_id == clerk_user_id)
    
    if run_id is not None:
        query = query.where(Job.run_id == run_id)
    if status is not None:
        query = query.where(Job.status == status)
    
    query = query.order_by(Job.created_at.desc())
    
    result = await db.execute(query)
    return list(result.scalars().all())


@router.get("/{job_id}", response_model=JobDetailResponse)
async def get_job(job_id: int, user: CurrentUser, db: DbSession):
    """Get job details including command history."""
    clerk_user_id = user.get("sub")
    
    result = await db.execute(
        select(Job).where(Job.id == job_id, Job.clerk_user_id == clerk_user_id)
    )
    job = result.scalar_one_or_none()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )
    
    # Get associated commands
    cmd_result = await db.execute(
        select(JobCommand)
        .where(JobCommand.job_id == job_id)
        .order_by(JobCommand.sequence)
    )
    commands = list(cmd_result.scalars().all())
    
    return JobDetailResponse(
        id=job.id,
        run_id=job.run_id,
        job_type=job.job_type,
        status=job.status,
        config=job.job_config,
        celery_task_id=job.celery_task_id,
        created_at=job.created_at,
        started_at=job.started_at,
        completed_at=job.completed_at,
        error_message=job.error_message,
        commands=[
            JobCommandResponse(
                id=cmd.id,
                command=cmd.command,
                working_dir=cmd.working_dir,
                stdout=cmd.stdout,
                stderr=cmd.stderr,
                exit_code=cmd.exit_code,
                status=cmd.status,
                started_at=cmd.started_at,
                completed_at=cmd.completed_at,
                duration_ms=cmd.duration_ms,
            )
            for cmd in commands
        ],
    )


@router.post("/{job_id}/cancel", response_model=JobResponse)
async def cancel_job(job_id: int, user: CurrentUser, db: DbSession):
    """Cancel a pending or queued job."""
    clerk_user_id = user.get("sub")
    
    result = await db.execute(
        select(Job).where(Job.id == job_id, Job.clerk_user_id == clerk_user_id)
    )
    job = result.scalar_one_or_none()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )
    
    if job.status not in [JobStatus.PENDING, JobStatus.QUEUED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel job with status {job.status}",
        )
    
    # Revoke Celery task if queued
    if job.celery_task_id:
        from celery_app import celery_app
        celery_app.control.revoke(job.celery_task_id, terminate=True)
    
    job.status = JobStatus.CANCELLED
    job.completed_at = datetime.now(timezone.utc)
    await db.commit()
    
    return job


@router.get("/{job_id}/result")
async def get_job_result(job_id: int, user: CurrentUser, db: DbSession):
    """Get the result of a completed job (e.g., file listing)."""
    clerk_user_id = user.get("sub")
    
    result = await db.execute(
        select(Job).where(Job.id == job_id, Job.clerk_user_id == clerk_user_id)
    )
    job = result.scalar_one_or_none()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )
    
    if job.status != JobStatus.SUCCESS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Job has not completed successfully. Status: {job.status}",
        )
    
    # Return result stored in job_config
    return {
        "job_id": job.id,
        "job_type": job.job_type,
        "result": job.job_config.get("result"),
    }
```

## Integration with Run Creation

### Modified Run Creation Flow

When a run is created, we automatically create the initial jobs:

```python
# In routers/runs.py - modify create_run endpoint

@router.post("", status_code=status.HTTP_201_CREATED, response_model=RunResponse)
async def create_run(body: CreateRunRequest, user: CurrentUser, db: DbSession):
    clerk_user_id = user.get("sub")
    
    # ... existing run creation logic ...
    
    run = Run(...)
    db.add(run)
    await db.commit()
    await db.refresh(run)
    
    # Get project info for repo URL
    project = await db.execute(
        select(Project).where(Project.id == body.project_id)
    )
    project = project.scalar_one()
    
    # Create initial jobs
    # Job 1: Clone the repository
    clone_job = Job(
        run_id=run.id,
        clerk_user_id=clerk_user_id,
        job_type=JobType.CLONE_REPO,
        job_config={
            "repo_url": project.repo_url,  # or construct from repo_owner/repo_name
            "branch": body.branch,
            "target_dir": "/workspace/repo",
            "depth": 1,  # Shallow clone for speed
        },
        status=JobStatus.PENDING,
        sequence=0,
    )
    db.add(clone_job)
    
    # Job 2: List files after clone
    list_job = Job(
        run_id=run.id,
        clerk_user_id=clerk_user_id,
        job_type=JobType.LIST_FILES,
        job_config={
            "target_dir": "/workspace/repo",
        },
        status=JobStatus.PENDING,
        sequence=1,
    )
    db.add(list_job)
    
    await db.commit()
    
    return run
```

## Environment Variables

Add to `.env`:

```bash
# Redis Cloud
REDIS_URL=rediss://default:password@redis-xxxxx.c1.region.cloud.redislabs.com:xxxxx/0

# Celery
CELERY_WORKER_CONCURRENCY=4
CELERY_TASK_TIMEOUT=3600
```

## Running the Workers

### Development

```bash
# Terminal 1: FastAPI server
cd apps/api
uv run uvicorn main:app --reload --port 8000

# Terminal 2: Celery worker
cd apps/api
uv run celery -A celery_app worker --loglevel=info -Q pod_ops,repo_ops

# Terminal 3: Celery beat (scheduler)
cd apps/api
uv run celery -A celery_app beat --loglevel=info
```

### Production (Dockerfile additions)

```dockerfile
# Celery worker
FROM python:3.13-slim
WORKDIR /app
COPY apps/api .
RUN pip install uv && uv sync
CMD ["celery", "-A", "celery_app", "worker", "--loglevel=info", "-Q", "pod_ops,repo_ops"]

# Celery beat
FROM python:3.13-slim
WORKDIR /app
COPY apps/api .
RUN pip install uv && uv sync
CMD ["celery", "-A", "celery_app", "beat", "--loglevel=info"]
```

## Monitoring

### Flower (Celery Monitoring)

```bash
# Install
uv add flower

# Run
uv run celery -A celery_app flower --port=5555
```

Access at http://localhost:5555 to monitor:
- Active workers
- Task progress
- Task history
- Queue lengths

## Error Handling & Retry Strategy

### Retry Configuration

```python
@celery_app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,  # 1 minute
    retry_backoff=True,  # Exponential backoff
    retry_backoff_max=600,  # Max 10 minutes
    retry_jitter=True,  # Add randomness to avoid thundering herd
)
def clone_repository(self, job_id: int):
    try:
        # ... task logic ...
    except SSHConnectionError as e:
        # Retry SSH connection errors
        raise self.retry(exc=e)
    except GitCloneError as e:
        # Don't retry git errors (likely permanent)
        raise
```

### Dead Letter Queue

Failed tasks after all retries go to a dead letter queue for investigation:

```python
app.conf.task_routes = {
    "celery_app.tasks.*": {
        "queue": "default",
        "routing_key": "default",
    },
}

app.conf.task_queue_max_priority = 10
app.conf.task_default_priority = 5
```

## Security Considerations

1. **SSH Key Storage**: Private keys stored in AWS Secrets Manager, fetched on-demand
2. **Redis TLS**: Use `rediss://` URL for TLS connections to Redis Cloud
3. **Task Validation**: Validate all task inputs, especially for custom commands
4. **Command Sanitization**: Prevent command injection for user-provided inputs
5. **Result Cleanup**: Set `result_expires` to automatically clean up old results

## Dependencies to Add

```bash
cd apps/api
uv add celery redis asyncssh flower pydantic-settings
```

## File Changes Summary

| File | Change |
|------|--------|
| `apps/api/pyproject.toml` | Add celery, redis, asyncssh, flower dependencies |
| `apps/api/celery_app/__init__.py` | Celery app configuration |
| `apps/api/celery_app/config.py` | Settings for Celery |
| `apps/api/celery_app/tasks/base.py` | Base task with DB access |
| `apps/api/celery_app/tasks/pod_tasks.py` | Pod-related tasks |
| `apps/api/celery_app/tasks/repo_tasks.py` | Repository tasks |
| `apps/api/celery_app/executors/base.py` | CommandExecutor base class |
| `apps/api/celery_app/executors/ssh.py` | SSH executor implementation |
| `apps/api/database.py` | Add Job and JobCommand models |
| `apps/api/routers/jobs.py` | Jobs API endpoints |
| `apps/api/routers/runs.py` | Integrate job creation |
| `apps/api/main.py` | Include jobs router |
| `alembic/versions/xxxx_add_jobs.py` | Database migration |

## Testing Strategy

1. **Unit Tests**: Test CommandExecutor with mock SSH
2. **Integration Tests**: Test against local Redis instance
3. **E2E Tests**: Test full flow with actual pods (staging environment)

```python
# Example test
@pytest.fixture
def celery_config():
    return {
        "broker_url": "memory://",
        "result_backend": "cache+memory://",
        "task_always_eager": True,  # Execute tasks synchronously in tests
    }

def test_clone_repository(celery_app, celery_worker):
    result = clone_repository.delay(job_id=1)
    assert result.get(timeout=10)["status"] == "success"
```
