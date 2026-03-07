"""Repository and command execution Celery tasks."""

import asyncio
import logging
import re
import shlex
from datetime import datetime, timezone
from typing import Any

from rlx_api.celery_app import celery_app
from rlx_api.celery_app.config import settings
from rlx_api.celery_app.executors.ssh import SSHCommandExecutor
from rlx_api.celery_app.tasks.base import DatabaseTask

logger = logging.getLogger(__name__)

LIVE_OUTPUT_FLUSH_INTERVAL_SECONDS = 5.0
PRIME_RL_COMMAND_PATTERN = re.compile(r"uv run rl @ (?P<config_path>\S+)")


def _is_prime_rl_launch_job(job_config: dict[str, Any]) -> bool:
    """Identify the final Prime RL launch step, including pre-flagged jobs."""
    if job_config.get("inject_wandb_api_key") is True:
        return True

    command = job_config.get("command")
    working_dir = job_config.get("working_dir")
    return (
        isinstance(command, str)
        and isinstance(working_dir, str)
        and working_dir == "/workspace/prime-rl"
        and "uv run rl @" in command
    )


def _resolve_custom_command_env(
    job_config: dict[str, Any],
    *,
    clerk_user_id: str,
) -> dict[str, str] | None:
    """Resolve configured env vars and optionally inject the user's W&B API key."""
    from rlx_api.services.aws_secrets_manager import (
        SecretsManagerError,
        get_wandb_api_key_secret,
    )

    raw_env = job_config.get("env")
    if raw_env is None:
        env: dict[str, str] = {}
    elif isinstance(raw_env, dict):
        env = {}
        for key, value in raw_env.items():
            if not isinstance(key, str):
                raise ValueError("Environment variable names must be strings")
            env[key] = "" if value is None else str(value)
    else:
        raise ValueError("env must be an object when provided in job config")

    if _is_prime_rl_launch_job(job_config):
        try:
            wandb_api_key = get_wandb_api_key_secret(clerk_user_id)
        except SecretsManagerError as exc:
            raise ValueError(f"Failed to retrieve W&B API key: {exc.message}") from exc

        if wandb_api_key:
            env["WANDB_API_KEY"] = wandb_api_key

    return env or None


def _extract_prime_rl_config_path(job_config: dict[str, Any]) -> str | None:
    """Extract the Prime RL config path from the launch command when present."""
    command = job_config.get("command")
    if not isinstance(command, str):
        return None

    match = PRIME_RL_COMMAND_PATTERN.search(command)
    if not match:
        return None

    return match.group("config_path")


def _maybe_wrap_with_wandb_setup(
    command: str,
    job_config: dict[str, Any],
) -> str:
    """
    Preflight W&B setup for Prime RL launch jobs.

    Prime RL starts trainer/orchestrator as subprocesses. Logging in explicitly
    before `uv run rl` ensures W&B auth is available even if env propagation
    across that subprocess tree is finicky.
    """
    if not _is_prime_rl_launch_job(job_config):
        return command

    config_path = _extract_prime_rl_config_path(job_config)
    if not config_path:
        return command

    login_snippet = (
        "import os, wandb; "
        "key = os.environ.get('WANDB_API_KEY'); "
        "assert key, 'WANDB_API_KEY missing for Prime RL config with [wandb]'; "
        "wandb.login(key=key, relogin=True); "
        "print('W&B login configured from WANDB_API_KEY')"
    )
    wandb_setup_command = (
        f"if grep -Eq '^[[:space:]]*\\[wandb\\][[:space:]]*$' {shlex.quote(config_path)}; then "
        "source $HOME/.local/bin/env && "
        f"uv run python -c {shlex.quote(login_snippet)}; "
        "fi"
    )
    return f"{wandb_setup_command} && {command}"


def get_executor_for_run(session, run_id: int) -> SSHCommandExecutor | None:
    """
    Create an SSH executor for the given run.
    Retrieves SSH connection string from DB and private key from AWS.

    Note: ssh_connection must be populated by check_pending_run_statuses
    before jobs can execute.
    """
    from rlx_api.database import Run, UserSshKey
    from rlx_api.services.aws_secrets_manager import get_private_key_secret

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

    # Read SSH connection string from database (populated by check_pending_run_statuses)
    if not run.ssh_connection:
        raise ValueError(
            f"SSH connection not available for run {run_id}. Run may not be active yet."
        )

    return SSHCommandExecutor.from_connection_string(
        connection_string=run.ssh_connection,
        private_key=private_key,
    )


def run_async(coro):
    """Helper to run async code in Celery tasks."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _persist_live_command_output(
    task: DatabaseTask,
    command_id: int,
    stdout: str,
    stderr: str,
) -> None:
    """Write the latest full stdout/stderr snapshots for a running command."""
    await asyncio.to_thread(
        task.replace_command_output,
        command_id,
        stdout=stdout,
        stderr=stderr,
    )


async def _execute_recorded_command(
    task: DatabaseTask,
    executor: SSHCommandExecutor,
    *,
    command_id: int,
    command: str,
    working_dir: str | None = None,
    timeout_seconds: int | None = None,
    env: dict[str, str] | None = None,
):
    """Execute a tracked command and persist live output snapshots while it runs."""
    return await executor.execute(
        command,
        working_dir=working_dir,
        timeout_seconds=timeout_seconds,
        env=env,
        on_snapshot=lambda stdout, stderr: _persist_live_command_output(
            task,
            command_id,
            stdout,
            stderr,
        ),
        snapshot_interval_seconds=LIVE_OUTPUT_FLUSH_INTERVAL_SECONDS,
    )


def _cancel_job(session, job, *, message: str, error_type: str = "run_terminated") -> None:
    """Mark a job as cancelled without leaving it in a stale running state."""
    from rlx_api.database import JobStatus

    if job.status == JobStatus.CANCELLED and job.completed_at is not None:
        return

    job.status = JobStatus.CANCELLED
    job.error_message = message
    job.error_type = error_type
    job.completed_at = datetime.now(timezone.utc)
    session.commit()


def _claim_job_for_execution(session, job_id: int):
    """Load a job and ensure its run is still active before doing any work."""
    from rlx_api.database import Job, JobStatus, Run, RunStatus

    job = session.query(Job).filter(Job.id == job_id).first()
    if not job:
        logger.error(f"Job {job_id} not found")
        return None

    run = session.query(Run).filter(Run.id == job.run_id).first()
    if not run:
        logger.error(f"Run {job.run_id} not found for job {job_id}")
        job.status = JobStatus.FAILED
        job.error_message = "Associated run not found"
        job.error_type = "run_not_found"
        job.completed_at = datetime.now(timezone.utc)
        session.commit()
        return None

    executable_statuses = [JobStatus.PENDING, JobStatus.QUEUED, JobStatus.RUNNING]
    if job.status not in executable_statuses:
        logger.info(f"Skipping job {job_id}; current status is {job.status}")
        return None

    if run.status != RunStatus.ACTIVE:
        _cancel_job(
            session,
            job,
            message=f"Run is {run.status}; job execution skipped.",
            error_type="run_inactive",
        )
        return None

    job.status = JobStatus.RUNNING
    if job.started_at is None:
        job.started_at = datetime.now(timezone.utc)
    session.commit()
    return job


def _should_skip_job_finalization(session, job_id: int) -> bool:
    """Return True when a job was cancelled or its run stopped mid-execution."""
    from rlx_api.database import Job, JobStatus, Run, RunStatus

    session.expire_all()
    job = session.query(Job).filter(Job.id == job_id).first()
    if not job:
        return True

    if job.status == JobStatus.CANCELLED:
        logger.info(f"Skipping finalization for cancelled job {job_id}")
        return True

    run = session.query(Run).filter(Run.id == job.run_id).first()
    if not run or run.status != RunStatus.ACTIVE:
        _cancel_job(
            session,
            job,
            message="Run terminated while job was executing.",
            error_type="run_terminated",
        )
        return True

    return False


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
    from rlx_api.database import Job, JobStatus

    logger.info(f"Starting clone_repository task for job {job_id}")

    with self.get_db_session() as session:
        job = _claim_job_for_execution(session, job_id)
        if not job:
            return {"job_id": job_id, "status": "cancelled"}

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
            # Use sudo to create directory and chown to current user (handles both root and non-root)
            mkdir_cmd = f"sudo mkdir -p {parent_dir} && sudo chown $(whoami):$(whoami) {parent_dir}"

            # Record command
            cmd_id = self.record_command(job_id, clone_cmd, None, sequence=0)

            # Run all async operations in a single event loop
            async def execute_clone():
                try:
                    # Ensure parent directory exists with correct permissions
                    logger.info(f"Ensuring parent directory exists: {mkdir_cmd}")
                    mkdir_result = await executor.execute(mkdir_cmd, timeout_seconds=30)
                    if not mkdir_result.success:
                        logger.warning(f"mkdir command failed: {mkdir_result.stderr}")

                    # Execute clone command
                    logger.info(f"Executing clone command: {clone_cmd}")
                    return await _execute_recorded_command(
                        self,
                        executor,
                        command_id=cmd_id,
                        command=clone_cmd,
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

            if _should_skip_job_finalization(session, job_id):
                return {"job_id": job_id, "status": "cancelled"}

            job = session.query(Job).filter(Job.id == job_id).first()

            if result.success:
                job.status = JobStatus.SUCCESS
                job.completed_at = datetime.now(timezone.utc)
                session.commit()

                logger.info(f"Job {job_id} completed successfully")

                # Start next job in sequence
                from rlx_api.celery_app.tasks.pod_tasks import start_next_job_for_run

                start_next_job_for_run(job.run_id)

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

                # Don't start next job - sequential jobs should stop on failure
                return {
                    "job_id": job_id,
                    "status": "failed",
                    "error": result.error_message,
                    "stderr": result.stderr,
                }

        except Exception as e:
            if _should_skip_job_finalization(session, job_id):
                return {"job_id": job_id, "status": "cancelled"}
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
    from rlx_api.database import Job, JobStatus

    logger.info(f"Starting list_files task for job {job_id}")

    with self.get_db_session() as session:
        job = _claim_job_for_execution(session, job_id)
        if not job:
            return {"job_id": job_id, "status": "cancelled"}

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
                    return await _execute_recorded_command(
                        self,
                        executor,
                        command_id=cmd_id,
                        command=list_cmd,
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

            if _should_skip_job_finalization(session, job_id):
                return {"job_id": job_id, "status": "cancelled"}

            job = session.query(Job).filter(Job.id == job_id).first()

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

                # Start next job in sequence
                from rlx_api.celery_app.tasks.pod_tasks import start_next_job_for_run

                start_next_job_for_run(job.run_id)

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

                # Don't start next job - sequential jobs should stop on failure
                return {
                    "job_id": job_id,
                    "status": "failed",
                    "error": result.error_message,
                }

        except Exception as e:
            if _should_skip_job_finalization(session, job_id):
                return {"job_id": job_id, "status": "cancelled"}
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
    from rlx_api.database import Job, JobStatus

    logger.info(f"Starting custom command task for job {job_id}")

    with self.get_db_session() as session:
        job = _claim_job_for_execution(session, job_id)
        if not job:
            return {"job_id": job_id, "status": "cancelled"}

        try:
            config = job.job_config
            command = config.get("command")
            if not command:
                raise ValueError("command is required in job config")
            command = _maybe_wrap_with_wandb_setup(command, config)

            working_dir = config.get("working_dir", "/workspace")
            timeout = config.get("timeout_seconds", settings.command_timeout)
            env = _resolve_custom_command_env(
                config,
                clerk_user_id=job.clerk_user_id,
            )

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
                    return await _execute_recorded_command(
                        self,
                        executor,
                        command_id=cmd_id,
                        command=command,
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

            if _should_skip_job_finalization(session, job_id):
                return {"job_id": job_id, "status": "cancelled"}

            job = session.query(Job).filter(Job.id == job_id).first()

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

                # Start next job in sequence
                from rlx_api.celery_app.tasks.pod_tasks import start_next_job_for_run

                start_next_job_for_run(job.run_id)

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

                # Don't start next job - sequential jobs should stop on failure
                return {
                    "job_id": job_id,
                    "status": "failed",
                    "error": result.error_message,
                    "exit_code": result.exit_code,
                }

        except Exception as e:
            if _should_skip_job_finalization(session, job_id):
                return {"job_id": job_id, "status": "cancelled"}
            logger.exception(f"Job {job_id} failed: {e}")
            job.status = JobStatus.FAILED
            job.error_message = str(e)
            job.completed_at = datetime.now(timezone.utc)
            session.commit()
            raise
