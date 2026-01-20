"""Repository and command execution Celery tasks."""

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
from celery_app.executors.ssh import SSHCommandExecutor
from celery_app.tasks.base import DatabaseTask

logger = logging.getLogger(__name__)


def get_executor_for_run(session, run_id: int) -> SSHCommandExecutor | None:
    """
    Create an SSH executor for the given run.
    Retrieves SSH connection details and private key.
    """
    from database import Run, UserSshKey
    from services.aws_secrets_manager import get_private_key_secret

    run = session.query(Run).filter(Run.id == run_id).first()
    if not run:
        logger.error(f"Run {run_id} not found")
        return None

    # Get SSH key for user
    ssh_key = (
        session.query(UserSshKey).filter(UserSshKey.clerk_user_id == run.clerk_user_id).first()
    )
    if not ssh_key:
        logger.error(f"No SSH key found for user {run.clerk_user_id}")
        raise ValueError(f"No SSH key found for user {run.clerk_user_id}")

    # Get private key from AWS Secrets Manager
    try:
        private_key = get_private_key_secret(ssh_key.aws_secret_arn)
    except Exception as e:
        logger.exception(f"Failed to get private key from AWS: {e}")
        raise ValueError(f"Failed to retrieve SSH key: {e}")

    # We need SSH connection info from Prime Intellect status
    # For now, we'll need to get the IP from the run's last status check
    # This should be stored in the database when status is checked
    # For this implementation, we'll query Prime Intellect directly

    from services.prime_intellect import fetch_pod_status, normalize_pod_response

    try:
        # Run this synchronously since we're in a Celery task
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            status_payload = loop.run_until_complete(fetch_pod_status([run.pod_id]))
        finally:
            loop.close()

        # Extract status data
        if isinstance(status_payload, dict):
            data = status_payload.get("data", status_payload)
            if isinstance(data, list) and len(data) > 0:
                status_data = normalize_pod_response(data[0])
            else:
                status_data = normalize_pod_response(data)
        elif isinstance(status_payload, list) and len(status_payload) > 0:
            status_data = normalize_pod_response(status_payload[0])
        else:
            raise ValueError("Could not extract pod status")

        ip_address = status_data.get("ip")
        ssh_connection = status_data.get("ssh_connection")

        if not ip_address:
            raise ValueError("Pod IP address not available")

        # Parse port from ssh_connection if available (format: "root@ip -p port")
        port = 22
        if ssh_connection and "-p" in ssh_connection:
            try:
                port = int(ssh_connection.split("-p")[1].strip().split()[0])
            except (ValueError, IndexError):
                pass

        logger.info(f"Creating SSH executor for {ip_address}:{port}")

        return SSHCommandExecutor(
            host=ip_address,
            port=port,
            username="root",
            private_key=private_key,
        )

    except Exception as e:
        logger.exception(f"Failed to get pod status for executor: {e}")
        raise ValueError(f"Failed to get pod connection info: {e}")


def run_async(coro):
    """Helper to run async code in Celery tasks."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(
    bind=True,
    base=DatabaseTask,
    max_retries=3,
    default_retry_delay=60,
    name="celery_app.tasks.repo_tasks.clone_repository",
)
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
    from database import Job, JobStatus

    logger.info(f"Starting clone_repository task for job {job_id}")

    with self.get_db_session() as session:
        job = session.query(Job).filter(Job.id == job_id).first()
        if not job:
            logger.error(f"Job {job_id} not found")
            return {"error": "Job not found", "job_id": job_id}

        # Update job status to RUNNING
        job.status = JobStatus.RUNNING
        job.started_at = datetime.now(timezone.utc)
        session.commit()

        try:
            config = job.job_config
            repo_url = config.get("repo_url")
            if not repo_url:
                raise ValueError("repo_url is required in job config")

            branch = config.get("branch", "main")
            target_dir = config.get("target_dir", "/workspace/repo")
            depth = config.get("depth")

            # Build clone command
            clone_cmd = "git clone"
            if depth:
                clone_cmd += f" --depth {depth}"
            if branch:
                clone_cmd += f" --branch {branch}"
            clone_cmd += f" {repo_url} {target_dir}"

            # Get executor
            executor = get_executor_for_run(session, job.run_id)
            if not executor:
                raise ValueError("Could not create SSH executor")

            # Create target directory's parent if needed
            parent_dir = "/".join(target_dir.rstrip("/").split("/")[:-1]) or "/"
            mkdir_cmd = f"mkdir -p {parent_dir}"

            # Record command
            cmd_id = self.record_command(job_id, clone_cmd, None, sequence=0)

            # Run all async operations in a single event loop
            async def execute_clone():
                try:
                    # Ensure parent directory exists
                    logger.info(f"Ensuring parent directory exists: {mkdir_cmd}")
                    await executor.execute(mkdir_cmd, timeout_seconds=30)

                    # Execute clone command
                    logger.info(f"Executing clone command: {clone_cmd}")
                    return await executor.execute(
                        clone_cmd,
                        timeout_seconds=settings.clone_timeout,
                    )
                finally:
                    await executor.close()

            result = run_async(execute_clone())

            # Update command result
            self.update_command_result(
                cmd_id,
                status=result.status.value,
                stdout=result.stdout,
                stderr=result.stderr,
                exit_code=result.exit_code,
                duration_ms=result.duration_ms,
            )

            if result.success:
                job.status = JobStatus.SUCCESS
                job.completed_at = datetime.now(timezone.utc)
                session.commit()

                logger.info(f"Job {job_id} completed successfully")
                return {
                    "job_id": job_id,
                    "status": "success",
                    "repo": repo_url,
                    "target_dir": target_dir,
                    "exit_code": result.exit_code,
                }
            else:
                job.status = JobStatus.FAILED
                job.error_message = result.error_message or result.stderr
                job.error_type = result.error_type or "clone_error"
                job.completed_at = datetime.now(timezone.utc)
                session.commit()

                logger.error(f"Job {job_id} failed: {result.error_message}")
                return {
                    "job_id": job_id,
                    "status": "failed",
                    "error": result.error_message,
                    "stderr": result.stderr,
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


@celery_app.task(
    bind=True,
    base=DatabaseTask,
    max_retries=3,
    default_retry_delay=30,
    name="celery_app.tasks.repo_tasks.list_files",
)
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
    from database import Job, JobStatus

    logger.info(f"Starting list_files task for job {job_id}")

    with self.get_db_session() as session:
        job = session.query(Job).filter(Job.id == job_id).first()
        if not job:
            return {"error": "Job not found", "job_id": job_id}

        job.status = JobStatus.RUNNING
        job.started_at = datetime.now(timezone.utc)
        session.commit()

        try:
            config = job.job_config
            target_dir = config.get("target_dir", "/workspace/repo")

            # Command to list files with type indicator
            # -1: one per line, -p: append / to directories, -A: show hidden except . and ..
            list_cmd = f"ls -1Ap {target_dir}"

            # Get executor
            executor = get_executor_for_run(session, job.run_id)
            if not executor:
                raise ValueError("Could not create SSH executor")

            # Record command
            cmd_id = self.record_command(job_id, list_cmd, target_dir, sequence=0)

            # Run all async operations in a single event loop
            async def execute_list():
                try:
                    logger.info(f"Executing list command: {list_cmd}")
                    return await executor.execute(
                        list_cmd,
                        timeout_seconds=settings.command_timeout,
                    )
                finally:
                    await executor.close()

            result = run_async(execute_list())

            # Update command result
            self.update_command_result(
                cmd_id,
                status=result.status.value,
                stdout=result.stdout,
                stderr=result.stderr,
                exit_code=result.exit_code,
                duration_ms=result.duration_ms,
            )

            if result.success:
                # Parse output to separate files and directories
                output_lines = [l.strip() for l in result.stdout.strip().split("\n") if l.strip()]
                directories = [l.rstrip("/") for l in output_lines if l.endswith("/")]
                files = [l for l in output_lines if not l.endswith("/")]

                job.status = JobStatus.SUCCESS
                job.completed_at = datetime.now(timezone.utc)

                # Store result in job config for easy retrieval
                job.job_config = {
                    **config,
                    "result": {
                        "files": files,
                        "directories": directories,
                    },
                }
                session.commit()

                logger.info(
                    f"Job {job_id} completed: {len(files)} files, {len(directories)} directories"
                )
                return {
                    "job_id": job_id,
                    "status": "success",
                    "files": files,
                    "directories": directories,
                }
            else:
                job.status = JobStatus.FAILED
                job.error_message = result.error_message or result.stderr
                job.error_type = result.error_type or "list_error"
                job.completed_at = datetime.now(timezone.utc)
                session.commit()

                return {
                    "job_id": job_id,
                    "status": "failed",
                    "error": result.error_message,
                }

        except Exception as e:
            logger.exception(f"Job {job_id} failed: {e}")
            job.status = JobStatus.FAILED
            job.error_message = str(e)
            job.completed_at = datetime.now(timezone.utc)
            session.commit()
            raise self.retry(exc=e)


@celery_app.task(
    bind=True,
    base=DatabaseTask,
    max_retries=2,
    default_retry_delay=30,
    name="celery_app.tasks.repo_tasks.run_custom_command",
)
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
    from database import Job, JobStatus

    logger.info(f"Starting custom command task for job {job_id}")

    with self.get_db_session() as session:
        job = session.query(Job).filter(Job.id == job_id).first()
        if not job:
            return {"error": "Job not found", "job_id": job_id}

        job.status = JobStatus.RUNNING
        job.started_at = datetime.now(timezone.utc)
        session.commit()

        try:
            config = job.job_config
            command = config.get("command")
            if not command:
                raise ValueError("command is required in job config")

            working_dir = config.get("working_dir", "/workspace")
            timeout = config.get("timeout_seconds", settings.command_timeout)
            env = config.get("env")

            # Get executor
            executor = get_executor_for_run(session, job.run_id)
            if not executor:
                raise ValueError("Could not create SSH executor")

            # Record command
            cmd_id = self.record_command(job_id, command, working_dir, sequence=0)

            # Run all async operations in a single event loop
            async def execute_custom():
                try:
                    logger.info(f"Executing custom command: {command[:100]}...")
                    return await executor.execute(
                        command,
                        working_dir=working_dir,
                        timeout_seconds=timeout,
                        env=env,
                    )
                finally:
                    await executor.close()

            result = run_async(execute_custom())

            # Update command result
            self.update_command_result(
                cmd_id,
                status=result.status.value,
                stdout=result.stdout,
                stderr=result.stderr,
                exit_code=result.exit_code,
                duration_ms=result.duration_ms,
            )

            if result.success:
                job.status = JobStatus.SUCCESS
                job.completed_at = datetime.now(timezone.utc)

                # Store result
                job.job_config = {
                    **config,
                    "result": {
                        "stdout": result.stdout,
                        "stderr": result.stderr,
                        "exit_code": result.exit_code,
                    },
                }
                session.commit()

                return {
                    "job_id": job_id,
                    "status": "success",
                    "exit_code": result.exit_code,
                    "stdout": result.stdout[:1000]
                    if result.stdout
                    else None,  # Truncate for response
                }
            else:
                job.status = JobStatus.FAILED
                job.error_message = result.error_message or result.stderr
                job.error_type = result.error_type or "command_error"
                job.completed_at = datetime.now(timezone.utc)
                session.commit()

                return {
                    "job_id": job_id,
                    "status": "failed",
                    "error": result.error_message,
                    "exit_code": result.exit_code,
                }

        except Exception as e:
            logger.exception(f"Job {job_id} failed: {e}")
            job.status = JobStatus.FAILED
            job.error_message = str(e)
            job.completed_at = datetime.now(timezone.utc)
            session.commit()
            raise
