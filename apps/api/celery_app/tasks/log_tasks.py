"""Log streaming Celery tasks."""

import asyncio
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

# Ensure apps/api is in Python path for worker processes
_API_DIR = Path(__file__).resolve().parent.parent.parent
if str(_API_DIR) not in sys.path:
    sys.path.insert(0, str(_API_DIR))

from celery_app import celery_app
from celery_app.config import settings
from celery_app.tasks.base import DatabaseTask
from celery_app.tasks.repo_tasks import get_executor_for_run, run_async

logger = logging.getLogger(__name__)

# Log file paths relative to output_dir on the pod
LOG_FILES = {
    "trainer": "logs/trainer.stdout",
    "orchestrator": "logs/orchestrator.stdout",
    "inference": "logs/inference.stdout",
    "rl": "logs/rl.log",
}

# Default output directory on the pod
DEFAULT_OUTPUT_DIR = "/workspace/prime-rl/output"

# How often to poll for new logs (seconds)
LOG_POLL_INTERVAL = 5

# Maximum bytes to read per poll
MAX_BYTES_PER_READ = 1024 * 1024  # 1MB


@celery_app.task(
    bind=True,
    base=DatabaseTask,
    name="celery_app.tasks.log_tasks.stream_job_logs",
)
def stream_job_logs(self, job_id: int, output_dir: str = DEFAULT_OUTPUT_DIR):
    """
    Stream logs from a running prime-RL job.

    This task polls the log files on the pod and stores new content in the database.
    It continues until the job is no longer RUNNING.

    Args:
        job_id: The job ID to stream logs for
        output_dir: The output directory on the pod where logs are stored
    """
    from database import Job, JobLog, JobLogOffset, JobStatus, LogType

    logger.info(f"Starting log streaming for job {job_id}")

    with self.get_db_session() as session:
        job = session.query(Job).filter(Job.id == job_id).first()
        if not job:
            logger.error(f"Job {job_id} not found")
            return {"error": "Job not found", "job_id": job_id}

        run_id = job.run_id

        # Get or create offsets for each log type
        offsets = {}
        for log_type in LogType:
            offset_record = (
                session.query(JobLogOffset)
                .filter(JobLogOffset.job_id == job_id, JobLogOffset.log_type == log_type)
                .first()
            )
            if not offset_record:
                offset_record = JobLogOffset(
                    job_id=job_id,
                    log_type=log_type,
                    byte_offset=0,
                )
                session.add(offset_record)
            offsets[log_type] = offset_record
        session.commit()

        # Get SSH executor
        try:
            executor = get_executor_for_run(session, run_id)
            if not executor:
                logger.error(f"Could not create SSH executor for job {job_id}")
                return {"error": "Could not create SSH executor", "job_id": job_id}
        except Exception as e:
            logger.error(f"Failed to get executor for job {job_id}: {e}")
            return {"error": str(e), "job_id": job_id}

        async def poll_logs():
            """Poll all log files and store new content."""
            nonlocal offsets

            try:
                for log_type in LogType:
                    log_file = LOG_FILES.get(log_type)
                    if not log_file:
                        continue

                    full_path = f"{output_dir}/{log_file}"
                    current_offset = offsets[log_type].byte_offset

                    # Use tail -c +{offset} to read from offset (1-indexed in tail)
                    # We add 1 because tail -c +N starts from byte N (1-indexed)
                    cmd = f"tail -c +{current_offset + 1} {full_path} 2>/dev/null | head -c {MAX_BYTES_PER_READ}"

                    try:
                        result = await executor.execute(cmd, timeout_seconds=30)

                        if result.success and result.stdout:
                            content = result.stdout
                            if content:
                                # Store the log chunk
                                log_entry = JobLog(
                                    job_id=job_id,
                                    run_id=run_id,
                                    log_type=log_type,
                                    content=content,
                                    byte_offset=current_offset,
                                )
                                session.add(log_entry)

                                # Update offset
                                new_offset = current_offset + len(content.encode('utf-8'))
                                offsets[log_type].byte_offset = new_offset
                                offsets[log_type].updated_at = datetime.now(timezone.utc)

                                logger.debug(
                                    f"Job {job_id}: Read {len(content)} bytes from {log_type} "
                                    f"(offset {current_offset} -> {new_offset})"
                                )
                    except Exception as e:
                        # Log file might not exist yet, which is fine
                        logger.debug(f"Could not read {log_type} log for job {job_id}: {e}")

                session.commit()

            except Exception as e:
                logger.exception(f"Error polling logs for job {job_id}: {e}")
                session.rollback()

        async def stream_loop():
            """Main streaming loop."""
            try:
                while True:
                    # Refresh job status
                    session.expire(job)
                    current_status = job.status

                    if current_status != JobStatus.RUNNING:
                        logger.info(
                            f"Job {job_id} is no longer running (status: {current_status}), "
                            "stopping log stream"
                        )
                        # Do one final poll to get any remaining logs
                        await poll_logs()
                        break

                    await poll_logs()
                    await asyncio.sleep(LOG_POLL_INTERVAL)

            finally:
                await executor.close()

        run_async(stream_loop())

        logger.info(f"Log streaming completed for job {job_id}")
        return {"job_id": job_id, "status": "completed"}


@celery_app.task(
    bind=True,
    base=DatabaseTask,
    name="celery_app.tasks.log_tasks.fetch_logs_once",
)
def fetch_logs_once(self, job_id: int, output_dir: str = DEFAULT_OUTPUT_DIR):
    """
    Fetch logs once for a job (used for manual refresh or catching up).

    Args:
        job_id: The job ID to fetch logs for
        output_dir: The output directory on the pod where logs are stored
    """
    from database import Job, JobLog, JobLogOffset, LogType

    logger.info(f"Fetching logs once for job {job_id}")

    with self.get_db_session() as session:
        job = session.query(Job).filter(Job.id == job_id).first()
        if not job:
            logger.error(f"Job {job_id} not found")
            return {"error": "Job not found", "job_id": job_id}

        run_id = job.run_id

        # Get or create offsets for each log type
        offsets = {}
        for log_type in LogType:
            offset_record = (
                session.query(JobLogOffset)
                .filter(JobLogOffset.job_id == job_id, JobLogOffset.log_type == log_type)
                .first()
            )
            if not offset_record:
                offset_record = JobLogOffset(
                    job_id=job_id,
                    log_type=log_type,
                    byte_offset=0,
                )
                session.add(offset_record)
            offsets[log_type] = offset_record
        session.commit()

        # Get SSH executor
        try:
            executor = get_executor_for_run(session, run_id)
            if not executor:
                logger.error(f"Could not create SSH executor for job {job_id}")
                return {"error": "Could not create SSH executor", "job_id": job_id}
        except Exception as e:
            logger.error(f"Failed to get executor for job {job_id}: {e}")
            return {"error": str(e), "job_id": job_id}

        async def fetch_all_logs():
            """Fetch all log files."""
            bytes_read = {}

            try:
                for log_type in LogType:
                    log_file = LOG_FILES.get(log_type)
                    if not log_file:
                        continue

                    full_path = f"{output_dir}/{log_file}"
                    current_offset = offsets[log_type].byte_offset

                    cmd = f"tail -c +{current_offset + 1} {full_path} 2>/dev/null | head -c {MAX_BYTES_PER_READ}"

                    try:
                        result = await executor.execute(cmd, timeout_seconds=30)

                        if result.success and result.stdout:
                            content = result.stdout
                            if content:
                                log_entry = JobLog(
                                    job_id=job_id,
                                    run_id=run_id,
                                    log_type=log_type,
                                    content=content,
                                    byte_offset=current_offset,
                                )
                                session.add(log_entry)

                                new_offset = current_offset + len(content.encode('utf-8'))
                                offsets[log_type].byte_offset = new_offset
                                offsets[log_type].updated_at = datetime.now(timezone.utc)
                                bytes_read[log_type] = len(content)
                    except Exception as e:
                        logger.debug(f"Could not read {log_type} log for job {job_id}: {e}")
                        bytes_read[log_type] = 0

                session.commit()
                return bytes_read

            finally:
                await executor.close()

        bytes_read = run_async(fetch_all_logs())

        logger.info(f"Fetched logs for job {job_id}: {bytes_read}")
        return {"job_id": job_id, "bytes_read": bytes_read}
