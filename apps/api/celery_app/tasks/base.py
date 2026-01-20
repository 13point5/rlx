"""Base task class with database session management."""

import logging
import os
import sys
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Generator

# Ensure apps/api is in Python path for worker processes
API_DIR = Path(__file__).resolve().parent.parent.parent
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

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
    """

    _db_engine = None
    _Session = None

    @property
    def db_engine(self):
        if DatabaseTask._db_engine is None:
            sync_url = get_sync_database_url()
            if not sync_url:
                raise RuntimeError("DATABASE_URL not configured")
            DatabaseTask._db_engine = create_engine(
                sync_url,
                echo=False,
                pool_pre_ping=True,
                pool_recycle=300,
            )
        return DatabaseTask._db_engine

    @property
    def Session(self) -> sessionmaker:
        if DatabaseTask._Session is None:
            DatabaseTask._Session = sessionmaker(bind=self.db_engine)
        return DatabaseTask._Session

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
        from database import Job

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
        from database import CommandStatus, JobCommand

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
        from database import JobCommand

        with self.get_db_session() as session:
            cmd = session.query(JobCommand).filter(JobCommand.id == command_id).first()
            if cmd:
                cmd.status = status
                cmd.stdout = stdout
                cmd.stderr = stderr
                cmd.exit_code = exit_code
                cmd.duration_ms = duration_ms
                cmd.completed_at = datetime.now(timezone.utc)
                session.commit()
