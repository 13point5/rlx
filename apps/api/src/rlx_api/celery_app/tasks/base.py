"""Base task class with database session management."""

import logging
import os
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Generator

from celery import Task
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

load_dotenv()

logger = logging.getLogger(__name__)

# Module-level engine and session factory for use outside tasks
_engine = None
_SessionFactory = None


def _get_engine():
    """Get or create the module-level database engine."""
    global _engine
    if _engine is None:
        sync_url = get_sync_database_url()
        if not sync_url:
            raise RuntimeError("DATABASE_URL not configured")
        _engine = create_engine(
            sync_url,
            echo=False,
            pool_pre_ping=True,
            pool_recycle=300,
        )
    return _engine


def _get_session_factory():
    """Get or create the module-level session factory."""
    global _SessionFactory
    if _SessionFactory is None:
        _SessionFactory = sessionmaker(bind=_get_engine())
    return _SessionFactory


@contextmanager
def get_sync_session() -> Generator[Session, None, None]:
    """
    Context manager for getting a database session outside of a Task.
    Useful for helper functions called from tasks.
    """
    session = _get_session_factory()()
    try:
        yield session
    finally:
        session.close()


def get_sync_database_url() -> str | None:
    """Get synchronous database URL for Celery tasks."""
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        return None

    # Convert async URL to sync URL
    sync_url = database_url.replace("postgresql+asyncpg", "postgresql")

    # Handle SSL settings
    sync_url = sync_url.replace("sslmode=require", "sslmode=require")
    sync_url = sync_url.replace("channel_binding=require&", "")
    sync_url = sync_url.replace("&channel_binding=require", "")
    sync_url = sync_url.replace("?channel_binding=require", "?")

    if sync_url.endswith("?"):
        sync_url = sync_url[:-1]

    return sync_url


class DatabaseTask(Task):
    """
    Base task class that provides database session management.
    Uses sync SQLAlchemy since Celery tasks run in separate processes.

    Shares the module-level engine and session factory with get_sync_session().
    """

    @property
    def db_engine(self):
        """Get the shared database engine."""
        return _get_engine()

    @property
    def Session(self) -> sessionmaker:
        """Get the shared session factory."""
        return _get_session_factory()

    @contextmanager
    def get_db_session(self) -> Generator[Session, None, None]:
        """Context manager for database session."""
        session = self.Session()
        try:
            yield session
        finally:
            session.close()

    def update_job_status(
        self,
        job_id: int,
        status: str,
        **kwargs,
    ) -> None:
        """Update job status in database."""
        from rlx_api.database import Job

        with self.get_db_session() as session:
            job = session.query(Job).filter(Job.id == job_id).first()
            if job:
                job.status = status
                for key, value in kwargs.items():
                    if hasattr(job, key):
                        setattr(job, key, value)
                session.commit()
                logger.info(f"Updated job {job_id} status to {status}")
            else:
                logger.warning(f"Job {job_id} not found for status update")

    def record_command(
        self,
        job_id: int,
        command: str,
        working_dir: str | None = None,
        sequence: int = 0,
    ) -> int:
        """Record a command execution in the database."""
        from rlx_api.database import CommandStatus, JobCommand

        with self.get_db_session() as session:
            cmd = JobCommand(
                job_id=job_id,
                command=command,
                working_dir=working_dir,
                status=CommandStatus.RUNNING,
                started_at=datetime.now(timezone.utc),
                sequence=sequence,
            )
            session.add(cmd)
            session.commit()
            session.refresh(cmd)
            return cmd.id

    def replace_command_output(
        self,
        command_id: int,
        *,
        stdout: str | None = None,
        stderr: str | None = None,
    ) -> None:
        """Replace stored command output with the latest monotonic snapshot."""
        from rlx_api.database import JobCommand

        with self.get_db_session() as session:
            cmd = session.query(JobCommand).filter(JobCommand.id == command_id).first()
            if not cmd:
                logger.warning("JobCommand %s not found for live output update", command_id)
                return

            updated = False

            if stdout is not None and len(stdout) >= len(cmd.stdout or ""):
                cmd.stdout = stdout
                updated = True

            if stderr is not None and len(stderr) >= len(cmd.stderr or ""):
                cmd.stderr = stderr
                updated = True

            if updated:
                session.commit()

    def update_command_result(
        self,
        command_id: int,
        status: str,
        stdout: str | None = None,
        stderr: str | None = None,
        exit_code: int | None = None,
        duration_ms: int | None = None,
    ) -> None:
        """Update command execution result."""
        from rlx_api.database import CommandStatus, JobCommand

        with self.get_db_session() as session:
            cmd = session.query(JobCommand).filter(JobCommand.id == command_id).first()
            if cmd:
                if (
                    cmd.status == CommandStatus.CANCELLED
                    and status != CommandStatus.CANCELLED
                ):
                    logger.info(
                        "Skipping command result update for cancelled command %s", command_id
                    )
                    return
                cmd.status = status
                if stdout is not None and len(stdout) >= len(cmd.stdout or ""):
                    cmd.stdout = stdout
                if stderr is not None and len(stderr) >= len(cmd.stderr or ""):
                    cmd.stderr = stderr
                cmd.exit_code = exit_code
                cmd.duration_ms = duration_ms
                cmd.completed_at = datetime.now(timezone.utc)
                session.commit()

    def ensure_run_log_stream(
        self,
        run_id: int,
        *,
        source: str,
        display_name: str,
        remote_path: str | None = None,
        status: str = "ACTIVE",
    ) -> int:
        """Create or update a persisted run log stream and return its id."""
        from rlx_api.database import RunLogStream

        with self.get_db_session() as session:
            stream = (
                session.query(RunLogStream)
                .filter(RunLogStream.run_id == run_id, RunLogStream.source == source)
                .first()
            )

            if stream is None:
                stream = RunLogStream(
                    run_id=run_id,
                    source=source,
                    display_name=display_name,
                    remote_path=remote_path,
                    status=status,
                )
                session.add(stream)
                session.commit()
                session.refresh(stream)
                return stream.id

            if remote_path and stream.remote_path != remote_path:
                stream.remote_path = remote_path
            stream.display_name = display_name
            stream.status = status
            stream.updated_at = datetime.now(timezone.utc)
            session.commit()
            return stream.id

    def append_run_log_chunk(
        self,
        run_id: int,
        *,
        source: str,
        display_name: str,
        content: str,
        start_offset: int,
        end_offset: int,
        remote_path: str | None = None,
        status: str = "ACTIVE",
    ) -> int:
        """Append text to a persisted run log stream and return the chunk sequence."""
        from rlx_api.database import RunLogChunk, RunLogStream

        if not content:
            return -1

        with self.get_db_session() as session:
            stream = (
                session.query(RunLogStream)
                .filter(RunLogStream.run_id == run_id, RunLogStream.source == source)
                .first()
            )
            if stream is None:
                stream = RunLogStream(
                    run_id=run_id,
                    source=source,
                    display_name=display_name,
                    remote_path=remote_path,
                    status=status,
                )
                session.add(stream)
                session.flush()

            next_sequence = (
                stream.last_chunk_sequence + 1
                if stream.last_chunk_sequence is not None
                else 0
            )
            chunk = RunLogChunk(
                stream_id=stream.id,
                sequence=next_sequence,
                start_offset=start_offset,
                end_offset=end_offset,
                content=content,
            )
            session.add(chunk)

            stream.display_name = display_name
            if remote_path and stream.remote_path != remote_path:
                stream.remote_path = remote_path
            stream.status = status
            stream.last_remote_offset = end_offset
            stream.last_chunk_sequence = next_sequence
            stream.updated_at = datetime.now(timezone.utc)
            session.commit()

            return next_sequence

    def mark_run_log_stream(
        self,
        run_id: int,
        *,
        source: str,
        status: str,
        last_remote_offset: int | None = None,
    ) -> None:
        """Update terminal state for a persisted run log stream."""
        from rlx_api.database import RunLogStream

        with self.get_db_session() as session:
            stream = (
                session.query(RunLogStream)
                .filter(RunLogStream.run_id == run_id, RunLogStream.source == source)
                .first()
            )
            if not stream:
                return

            stream.status = status
            if last_remote_offset is not None:
                stream.last_remote_offset = last_remote_offset
            stream.updated_at = datetime.now(timezone.utc)
            if status in {"COMPLETE", "ERROR"}:
                stream.completed_at = datetime.now(timezone.utc)
            session.commit()

    def set_run_wandb_run(
        self,
        run_id: int,
        *,
        source: str,
        run_url: str,
        wandb_run_id: str,
    ) -> None:
        """Persist structured W&B metadata on the run row."""
        from rlx_api.database import Run
        from rlx_api.run_observability import WandbRunMetadata, merge_wandb_run_metadata

        with self.get_db_session() as session:
            run = session.query(Run).filter(Run.id == run_id).first()
            if not run:
                return

            monitoring = merge_wandb_run_metadata(
                run.monitoring,
                source=source,
                metadata=WandbRunMetadata(run_id=wandb_run_id, url=run_url),
            )
            if monitoring == (run.monitoring or {}):
                return

            run.monitoring = monitoring
            run.updated_at = datetime.now(timezone.utc)
            session.commit()
