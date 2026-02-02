import os
from datetime import datetime, timezone
from enum import StrEnum
from typing import AsyncGenerator

from dotenv import load_dotenv
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase


class RunStatus(StrEnum):
    """Status values for training runs."""

    PROVISIONING = "PROVISIONING"
    ACTIVE = "ACTIVE"
    PENDING = "PENDING"
    ERROR = "ERROR"
    STOPPED = "STOPPED"
    TERMINATED = "TERMINATED"


class JobStatus(StrEnum):
    """Status values for jobs."""

    PENDING = "PENDING"  # Waiting for pod to be ready
    QUEUED = "QUEUED"  # In Celery queue
    RUNNING = "RUNNING"  # Currently executing
    SUCCESS = "SUCCESS"  # Completed successfully
    FAILED = "FAILED"  # Execution failed
    TIMEOUT = "TIMEOUT"  # Timed out
    CANCELLED = "CANCELLED"  # Cancelled by user


class JobType(StrEnum):
    """Types of jobs."""

    CLONE_REPO = "CLONE_REPO"
    LIST_FILES = "LIST_FILES"
    CUSTOM_COMMAND = "CUSTOM_COMMAND"


class CommandStatus(StrEnum):
    """Status of command execution."""

    PENDING = "PENDING"
    RUNNING = "RUNNING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    TIMEOUT = "TIMEOUT"
    CANCELLED = "CANCELLED"


class RunFinalizedStatus(StrEnum):
    """Status of run finalization for metrics logging."""

    ACTIVE = "ACTIVE"
    FINALIZED = "FINALIZED"


load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# Convert sslmode to ssl for asyncpg compatibility
if DATABASE_URL:
    # asyncpg uses 'ssl' instead of 'sslmode'
    DATABASE_URL = DATABASE_URL.replace("sslmode=require", "ssl=require")
    # Also remove channel_binding which asyncpg doesn't support
    DATABASE_URL = DATABASE_URL.replace("channel_binding=require&", "")
    DATABASE_URL = DATABASE_URL.replace("&channel_binding=require", "")
    DATABASE_URL = DATABASE_URL.replace("?channel_binding=require", "?")
    # Clean up any trailing ? or &
    if DATABASE_URL.endswith("?"):
        DATABASE_URL = DATABASE_URL[:-1]

engine = (
    create_async_engine(
        DATABASE_URL,
        echo=True,
        pool_pre_ping=True,  # Test connections before using them (handles idle timeouts)
        pool_recycle=300,  # Recycle connections after 5 minutes
        connect_args={
            "statement_cache_size": 0,  # Disable statement caching to avoid InvalidCachedStatementError after migrations
        },
    )
    if DATABASE_URL
    else None
)
async_session = (
    async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False) if engine else None
)


class Base(DeclarativeBase):
    pass


class GitHubConnection(Base):
    __tablename__ = "github_connections"

    id = Column(Integer, primary_key=True)
    clerk_user_id = Column(String, unique=True, index=True, nullable=False)
    github_user_id = Column(String)
    github_username = Column(String)
    access_token = Column(String, nullable=False)
    refresh_token = Column(String)
    token_expires_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True)
    clerk_user_id = Column(String, nullable=False, index=True)
    repo_id = Column(Integer, nullable=False)  # GitHub repo ID (permanent unique identifier)
    repo_name = Column(String, nullable=False)  # repo name
    repo_owner = Column(String, nullable=False)  # repo owner
    repo_owner_type = Column(String, nullable=False)  # "User" or "Organization"
    repo_url = Column(String, nullable=False)  # Full GitHub URL
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Unique constraint: one project per user per repo
    __table_args__ = (UniqueConstraint("clerk_user_id", "repo_id", name="unique_user_repo"),)

    # Property to derive full_name when needed (not stored in DB)
    @property
    def repo_full_name(self) -> str:
        return f"{self.repo_owner}/{self.repo_name}"


class Run(Base):
    __tablename__ = "runs"

    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    clerk_user_id = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    branch = Column(String, nullable=False)
    # Config name from rlx.toml (resolved at job execution time)
    config_name = Column(String, nullable=False)
    status = Column(String, nullable=False, default="provisioning")
    provider = Column(String, nullable=False)
    region = Column(String, nullable=False)
    data_center = Column(String)
    country = Column(String)
    gpu_type = Column(String, nullable=False)
    gpu_count = Column(Integer, nullable=False)
    security = Column(String, nullable=False)
    cloud_id = Column(String, nullable=False)
    pod_id = Column(String, nullable=False)
    is_spot = Column(Boolean, nullable=False, default=False)
    # Pod connection info (populated when status becomes ACTIVE)
    # Raw SSH connection string from Prime Intellect (e.g., "ssh ubuntu@1.2.3.4 -p 22")
    ssh_connection = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class UserSshKey(Base):
    __tablename__ = "user_ssh_keys"

    id = Column(Integer, primary_key=True)
    clerk_user_id = Column(String, nullable=False, index=True)
    public_key = Column(String, nullable=False)
    prime_ssh_key_id = Column(String, nullable=False)
    aws_secret_arn = Column(String, nullable=False)
    name = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


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


# ============================================================================
# Prime-RL Metrics Logging Tables
# ============================================================================


class RunMetrics(Base):
    """
    Stores scalar metrics logged during training runs.
    Compatible with PrimeMonitor's log() method.
    Each row represents a set of metrics at a given step.
    """

    __tablename__ = "run_metrics"

    id = Column(Integer, primary_key=True)
    run_id = Column(Integer, ForeignKey("runs.id"), nullable=False)
    step = Column(Integer, nullable=True)  # Training step (optional)

    # Store all metrics as JSON for flexibility
    # e.g., {"reward/mean": 0.5, "loss/mean": 0.1, "perf/throughput": 1000}
    metrics = Column(JSON, nullable=False)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("ix_run_metrics_run_id", "run_id"),
        Index("ix_run_metrics_run_step", "run_id", "step"),
    )


class RunSample(Base):
    """
    Stores sample/rollout data from training.
    Compatible with PrimeMonitor's log_samples() method.
    Stores complete trajectory data for each sample.
    """

    __tablename__ = "run_samples"

    id = Column(Integer, primary_key=True)
    run_id = Column(Integer, ForeignKey("runs.id"), nullable=False)
    step = Column(Integer, nullable=False)

    # Sample identification
    example_id = Column(String, nullable=True)

    # Prompt and completion (stored as JSON arrays of messages)
    prompt = Column(JSON, nullable=True)
    completion = Column(JSON, nullable=True)

    # Trajectory: array of {prompt, completion, reward, advantage, extras, ...}
    trajectory = Column(JSON, nullable=True)

    # Scalar values
    reward = Column(Float, nullable=True)
    advantage = Column(Float, nullable=True)

    # Additional fields
    answer = Column(Text, nullable=True)
    task = Column(String, nullable=True)

    # Metadata (stored as JSON)
    info = Column(JSON, nullable=True)
    sample_metrics = Column(JSON, nullable=True)
    timing = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("ix_run_samples_run_id", "run_id"),
        Index("ix_run_samples_run_step", "run_id", "step"),
    )


class RunDistribution(Base):
    """
    Stores distribution data (rewards, advantages) at each step.
    Compatible with PrimeMonitor's log_distributions() method.
    """

    __tablename__ = "run_distributions"

    id = Column(Integer, primary_key=True)
    run_id = Column(Integer, ForeignKey("runs.id"), nullable=False)
    step = Column(Integer, nullable=False)

    # Distribution data: {"rewards": [...], "advantages": [...]}
    distributions = Column(JSON, nullable=False)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("ix_run_distributions_run_id", "run_id"),
        Index("ix_run_distributions_run_step", "run_id", "step"),
    )


class RunSummary(Base):
    """
    Stores final run summary when training completes.
    Compatible with PrimeMonitor's save_final_summary() method.
    """

    __tablename__ = "run_summaries"

    id = Column(Integer, primary_key=True)
    run_id = Column(Integer, ForeignKey("runs.id"), nullable=False, unique=True)

    # Final summary data
    summary = Column(JSON, nullable=False)

    # Finalization status
    status = Column(String, nullable=False, default=RunFinalizedStatus.ACTIVE)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    finalized_at = Column(DateTime(timezone=True), nullable=True)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency that provides a database session."""
    if async_session is None:
        raise RuntimeError("Database not configured. Set DATABASE_URL environment variable.")
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
