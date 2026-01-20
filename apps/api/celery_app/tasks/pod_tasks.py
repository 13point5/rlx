"""Pod-related Celery tasks."""

import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

# Ensure apps/api is in Python path for worker processes
_API_DIR = Path(__file__).resolve().parent.parent.parent
if str(_API_DIR) not in sys.path:
    sys.path.insert(0, str(_API_DIR))

from celery_app import celery_app
from celery_app.tasks.base import DatabaseTask

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, base=DatabaseTask, name="celery_app.tasks.pod_tasks.check_pending_jobs")
def check_pending_jobs(self):
    """
    Periodic task that checks for pending jobs and starts them when pods are ready.
    This runs every 30 seconds via Celery Beat.
    """
    from database import Job, JobStatus, Run, RunStatus

    with self.get_db_session() as session:
        # Find all pending jobs where the associated run is ACTIVE
        pending_jobs = (
            session.query(Job)
            .join(Run, Job.run_id == Run.id)
            .filter(
                Job.status == JobStatus.PENDING,
                Run.status == RunStatus.ACTIVE,
            )
            .order_by(Job.run_id, Job.sequence)
            .all()
        )

        queued_count = 0
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
                queued_count += 1

        logger.info(f"Checked {len(pending_jobs)} pending jobs, queued {queued_count}")
        return {"checked": len(pending_jobs), "queued": queued_count}


@celery_app.task(
    bind=True,
    base=DatabaseTask,
    max_retries=3,
    name="celery_app.tasks.pod_tasks.on_pod_ready",
)
def on_pod_ready(self, run_id: int):
    """
    Called when a pod transitions to ACTIVE status.
    This triggers any pending jobs for that run.
    """
    from database import Job, JobStatus

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

        if pending_jobs:
            # Trigger job processing
            check_pending_jobs.delay()
            logger.info(f"Triggered job processing for run {run_id} with {len(pending_jobs)} pending jobs")

    return {"run_id": run_id, "pending_jobs": len(pending_jobs)}


@celery_app.task(
    bind=True,
    base=DatabaseTask,
    name="celery_app.tasks.pod_tasks.check_run_status",
)
def check_run_status(self, run_id: int) -> dict:
    """
    Check the status of a specific run and trigger jobs if it's active.
    Called after run creation to monitor pod status.
    """
    from database import Run, RunStatus

    with self.get_db_session() as session:
        run = session.query(Run).filter(Run.id == run_id).first()
        if not run:
            logger.warning(f"Run {run_id} not found")
            return {"run_id": run_id, "status": "not_found"}

        if run.status == RunStatus.ACTIVE:
            # Pod is ready, trigger job processing
            on_pod_ready.delay(run_id)
            return {"run_id": run_id, "status": "active", "jobs_triggered": True}

        return {"run_id": run_id, "status": run.status}
