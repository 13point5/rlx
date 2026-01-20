"""Pod-related Celery tasks."""

import logging
import sys
from pathlib import Path

# Ensure apps/api is in Python path for worker processes
_API_DIR = Path(__file__).resolve().parent.parent.parent
if str(_API_DIR) not in sys.path:
    sys.path.insert(0, str(_API_DIR))

from celery_app import celery_app  # noqa: E402
from celery_app.tasks.base import DatabaseTask  # noqa: E402

logger = logging.getLogger(__name__)


def queue_job(job, session):
    """Queue a single job for execution."""
    from database import JobStatus

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
        logger.info(f"Queued job {job.id} (type: {job.job_type}, seq: {job.sequence})")
        return True
    return False


def start_next_job_for_run(run_id: int):
    """
    Start the next pending job for a run (by sequence order).
    Called after a job completes to continue the sequence.
    """
    from database import Job, JobStatus, Run, RunStatus
    from celery_app.tasks.base import get_sync_session

    with get_sync_session() as session:
        # Check if run is still active
        run = session.query(Run).filter(Run.id == run_id).first()
        if not run or run.status != RunStatus.ACTIVE:
            logger.info(f"Run {run_id} is not active, skipping next job")
            return None

        # Find the next pending job by sequence
        next_job = (
            session.query(Job)
            .filter(
                Job.run_id == run_id,
                Job.status == JobStatus.PENDING,
            )
            .order_by(Job.sequence)
            .first()
        )

        if next_job:
            logger.info(
                f"Starting next job {next_job.id} (seq: {next_job.sequence}) for run {run_id}"
            )
            queue_job(next_job, session)
            return next_job.id
        else:
            logger.info(f"No more pending jobs for run {run_id}")
            return None


@celery_app.task(bind=True, base=DatabaseTask, name="celery_app.tasks.pod_tasks.check_pending_jobs")
def check_pending_jobs(self):
    """
    Periodic task that checks for stalled jobs.
    Main job sequencing is handled by on_pod_ready and start_next_job_for_run.
    This is a fallback to catch any jobs that got stuck.
    """
    from database import Job, JobStatus, Run, RunStatus

    with self.get_db_session() as session:
        # Find runs that are ACTIVE with pending jobs but no running/queued jobs
        # This catches edge cases where job completion didn't trigger the next one

        active_runs_with_pending = (
            session.query(Run)
            .join(Job, Job.run_id == Run.id)
            .filter(
                Run.status == RunStatus.ACTIVE,
                Job.status == JobStatus.PENDING,
            )
            .distinct()
            .all()
        )

        queued_count = 0
        for run in active_runs_with_pending:
            # Check if this run has any running/queued jobs
            active_job = (
                session.query(Job)
                .filter(
                    Job.run_id == run.id,
                    Job.status.in_([JobStatus.RUNNING, JobStatus.QUEUED]),
                )
                .first()
            )

            if not active_job:
                # No active jobs, start the next one
                next_job = (
                    session.query(Job)
                    .filter(
                        Job.run_id == run.id,
                        Job.status == JobStatus.PENDING,
                    )
                    .order_by(Job.sequence)
                    .first()
                )

                if next_job:
                    logger.info(f"[Fallback] Starting job {next_job.id} for run {run.id}")
                    if queue_job(next_job, session):
                        queued_count += 1

        logger.info(f"Fallback check complete, queued {queued_count} jobs")
        return {"queued": queued_count}


@celery_app.task(
    bind=True,
    base=DatabaseTask,
    max_retries=3,
    name="celery_app.tasks.pod_tasks.on_pod_ready",
)
def on_pod_ready(self, run_id: int):
    """
    Called when a pod transitions to ACTIVE status.
    Starts the FIRST job (sequence 0) for the run.
    Subsequent jobs are started when each job completes.
    """
    from database import Job, JobStatus

    logger.info(f"Pod ready for run {run_id}, starting first job")

    with self.get_db_session() as session:
        # Get the first pending job by sequence
        first_job = (
            session.query(Job)
            .filter(
                Job.run_id == run_id,
                Job.status == JobStatus.PENDING,
            )
            .order_by(Job.sequence)
            .first()
        )

        if first_job:
            queue_job(first_job, session)
            logger.info(
                f"Started first job {first_job.id} (type: {first_job.job_type}) for run {run_id}"
            )
            return {"run_id": run_id, "started_job_id": first_job.id}
        else:
            logger.info(f"No pending jobs for run {run_id}")
            return {"run_id": run_id, "started_job_id": None}


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
