import logging
import posixpath
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from rlx_api.database import (
    CommandStatus,
    Job,
    JobCommand,
    JobStatus,
    Project,
    Run,
    RunLogChunk,
    RunLogSource,
    RunLogStream,
    RunStatus,
    UserSshKey,
)
from rlx_api.deps import (
    CurrentUser,
    DbSession,
    get_github_connection,
    get_valid_github_token,
)
from rlx_api.job_templates import create_jobs_from_templates
from rlx_api.run_observability import (
    choose_default_run_log_source,
    get_run_log_source_label,
    is_surfaced_run_log_source,
    order_run_log_sources,
)
from rlx_api.services import github as github_service
from rlx_api.services.github import (
    GitHubAPIError,
    GitHubNoAccessError,
    GitHubRateLimitError,
    GitHubTokenInvalidError,
)
from rlx_api.services.prime_intellect import (
    DEFAULT_IMAGE,
    PrimeIntellectAPIError,
    create_pod,
    delete_pod,
    normalize_pod_response,
)

router = APIRouter(prefix="/api/runs", tags=["runs"])
logger = logging.getLogger(__name__)


def strip_origin_prefix(branch: str) -> str:
    """
    Strip 'origin/' prefix from a branch name for git clone.

    The UI sends branches as 'origin/main' for display purposes,
    but git clone --branch expects just 'main'.
    """
    if branch.startswith("origin/"):
        return branch[7:]  # len("origin/") == 7
    return branch


@dataclass
class ResolvedRunConfig:
    """Concrete config information derived from the selected rlx.toml entry."""

    branch: str
    config_path: str
    env_path: str | None
    env_vars: dict[str, str] | None


class InstanceSelection(BaseModel):
    cloud_id: str
    gpu_type: str
    gpu_count: int
    socket: str
    provider: str
    region: str
    data_center: str | None = None
    country: str | None = None
    security: str
    is_spot: bool = False


class CreateRunRequest(BaseModel):
    project_id: int
    name: str
    branch: str
    config_name: str  # Selected config name from rlx.toml
    instance: InstanceSelection


class RunResponse(BaseModel):
    id: int
    project_id: int
    name: str
    branch: str
    config_name: str
    status: str
    provider: str
    region: str
    data_center: str | None
    country: str | None
    gpu_type: str
    gpu_count: int
    security: str
    cloud_id: str
    monitoring: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime | None

    class Config:
        from_attributes = True


class RunStatusResponse(BaseModel):
    status: str
    ssh_connection: str | None = None


class RunTerminateResponse(BaseModel):
    status: str
    pod_id: str


class RunStatusItem(BaseModel):
    status: str
    ssh_connection: str | None = None


class SyncJobsResponse(BaseModel):
    added_count: int
    message: str


class RunLogStreamSummary(BaseModel):
    source: str
    display_name: str
    status: str
    latest_sequence: int
    remote_path: str | None = None
    updated_at: datetime | None
    completed_at: datetime | None


class WandbRunSummary(BaseModel):
    run_id: str
    url: str


class RunObservabilityResponse(BaseModel):
    run_id: int
    status: str
    default_source: str | None
    streams: list[RunLogStreamSummary]
    wandb: dict[str, WandbRunSummary]


class RunLogChunkResponse(BaseModel):
    sequence: int
    start_offset: int
    end_offset: int
    content: str
    created_at: datetime


class RunLogResponse(BaseModel):
    run_id: int
    source: str
    display_name: str
    status: str
    latest_sequence: int
    chunks: list[RunLogChunkResponse]


async def get_run_or_404(run_id: int, clerk_user_id: str, db: DbSession) -> Run:
    result = await db.execute(
        select(Run).where(Run.id == run_id, Run.clerk_user_id == clerk_user_id)
    )
    run = result.scalar_one_or_none()

    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")

    return run


def run_log_stream_to_summary(stream: RunLogStream) -> RunLogStreamSummary:
    """Serialize a persisted run log stream for the UI."""
    return RunLogStreamSummary(
        source=stream.source,
        display_name=stream.display_name or get_run_log_source_label(stream.source),
        status=stream.status,
        latest_sequence=stream.last_chunk_sequence,
        remote_path=stream.remote_path,
        updated_at=stream.updated_at,
        completed_at=stream.completed_at,
    )


def get_run_wandb_summaries(run: Run) -> dict[str, WandbRunSummary]:
    """Extract persisted W&B run links from run.monitoring."""
    raw_wandb = (run.monitoring or {}).get("wandb")
    if not isinstance(raw_wandb, dict):
        return {}

    summaries: dict[str, WandbRunSummary] = {}
    for source, payload in raw_wandb.items():
        if not isinstance(payload, dict):
            continue
        run_id = payload.get("run_id")
        url = payload.get("url")
        if isinstance(run_id, str) and isinstance(url, str):
            summaries[source] = WandbRunSummary(run_id=run_id, url=url)

    return summaries


async def resolve_run_config(
    *,
    clerk_user_id: str,
    project: Project,
    branch: str,
    config_name: str,
    db: DbSession,
) -> ResolvedRunConfig:
    """
    Resolve the selected rlx.toml entry to a concrete Prime RL launch config.

    The UI selects a config by name, but the launch job needs the underlying
    `config = "path/to/file.toml"` value.
    """
    clean_branch = strip_origin_prefix(branch)
    connection = await get_github_connection(clerk_user_id, db)
    access_token = await get_valid_github_token(connection, db)

    try:
        rlx_config = await github_service.fetch_rlx_config(
            access_token,
            owner=project.repo_owner,
            repo=project.repo_name,
            branch=clean_branch,
        )
    except GitHubTokenInvalidError:
        new_token = await github_service.refresh_token(connection, db)
        if not new_token:
            await db.delete(connection)
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="GitHub token expired. Please reconnect your GitHub account.",
            )

        try:
            rlx_config = await github_service.fetch_rlx_config(
                new_token,
                owner=project.repo_owner,
                repo=project.repo_name,
                branch=clean_branch,
            )
        except GitHubNoAccessError:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You don't have access to repository {project.repo_owner}/{project.repo_name}.",
            )
        except GitHubRateLimitError:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="GitHub API rate limit exceeded. Please try again later.",
            )
        except GitHubAPIError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=str(exc),
            )
        access_token = new_token
    except GitHubNoAccessError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You don't have access to repository {project.repo_owner}/{project.repo_name}.",
        )
    except GitHubRateLimitError:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="GitHub API rate limit exceeded. Please try again later.",
        )
    except GitHubAPIError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )

    if not rlx_config.found:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No rlx.toml found in the selected repository branch.",
        )

    selected_entry = next(
        (entry for entry in rlx_config.configs if entry.name == config_name),
        None,
    )
    if not selected_entry:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Config '{config_name}' was not found in rlx.toml for branch '{clean_branch}'.",
        )

    if not selected_entry.config:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Config '{config_name}' does not define a single config path. "
                "RLX currently launches Prime RL from the `config` field."
            ),
        )

    try:
        config_exists = await github_service.repo_file_exists(
            access_token,
            owner=project.repo_owner,
            repo=project.repo_name,
            path=selected_entry.config,
            branch=clean_branch,
        )
    except GitHubTokenInvalidError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="GitHub token expired while validating the selected config file.",
        )
    except GitHubNoAccessError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You don't have access to repository {project.repo_owner}/{project.repo_name}.",
        )
    except GitHubRateLimitError:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="GitHub API rate limit exceeded. Please try again later.",
        )
    except GitHubAPIError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )

    if not config_exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Config file '{selected_entry.config}' for entry '{config_name}' "
                f"was not found in branch '{clean_branch}'."
            ),
        )

    env_path = selected_entry.env_path
    if env_path:
        env_pyproject = posixpath.join(env_path, "pyproject.toml")
        env_setup_py = posixpath.join(env_path, "setup.py")
        try:
            env_installable = await github_service.repo_file_exists(
                access_token,
                owner=project.repo_owner,
                repo=project.repo_name,
                path=env_pyproject,
                branch=clean_branch,
            ) or await github_service.repo_file_exists(
                access_token,
                owner=project.repo_owner,
                repo=project.repo_name,
                path=env_setup_py,
                branch=clean_branch,
            )
        except GitHubTokenInvalidError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="GitHub token expired while validating the selected environment path.",
            )
        except GitHubNoAccessError:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You don't have access to repository {project.repo_owner}/{project.repo_name}.",
            )
        except GitHubRateLimitError:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="GitHub API rate limit exceeded. Please try again later.",
            )
        except GitHubAPIError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=str(exc),
            )

        if not env_installable:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Environment path '{env_path}' for entry '{config_name}' is not an "
                    f"installable Python project in branch '{clean_branch}'."
                ),
            )

    return ResolvedRunConfig(
        branch=clean_branch,
        config_path=selected_entry.config,
        env_path=env_path,
        env_vars=selected_entry.env_vars,
    )


async def cancel_inflight_jobs_for_run(run_id: int, db: DbSession) -> list[str]:
    """
    Mark active jobs/commands for a run as cancelled and return Celery task IDs to revoke.

    This is used when a run is terminated so the UI and worker state converge on the
    same terminal status instead of leaving stale RUNNING rows behind.
    """
    now = datetime.now(timezone.utc)
    active_job_statuses = [JobStatus.PENDING, JobStatus.QUEUED, JobStatus.RUNNING]
    active_command_statuses = [CommandStatus.PENDING, CommandStatus.RUNNING]

    jobs_result = await db.execute(
        select(Job).where(Job.run_id == run_id, Job.status.in_(active_job_statuses))
    )
    jobs = list(jobs_result.scalars().all())

    task_ids: list[str] = []
    for job in jobs:
        if job.celery_task_id:
            task_ids.append(job.celery_task_id)
        job.status = JobStatus.CANCELLED
        job.error_type = "run_terminated"
        job.error_message = "Run terminated by user."
        job.completed_at = now

    if jobs:
        job_ids = [job.id for job in jobs]
        commands_result = await db.execute(
            select(JobCommand).where(
                JobCommand.job_id.in_(job_ids),
                JobCommand.status.in_(active_command_statuses),
            )
        )
        commands = list(commands_result.scalars().all())

        for command in commands:
            command.status = CommandStatus.CANCELLED
            command.completed_at = now
            if command.started_at is not None:
                command.duration_ms = int((now - command.started_at).total_seconds() * 1000)

    return task_ids


def revoke_celery_tasks(task_ids: list[str]) -> None:
    """Best-effort revocation of queued/running Celery tasks for a terminated run."""
    if not task_ids:
        return

    from rlx_api.celery_app import celery_app

    for task_id in task_ids:
        try:
            celery_app.control.revoke(task_id, terminate=True)
        except Exception:
            logger.warning("Failed to revoke Celery task %s", task_id, exc_info=True)


@router.post("", status_code=status.HTTP_201_CREATED, response_model=RunResponse)
async def create_run(body: CreateRunRequest, user: CurrentUser, db: DbSession):
    clerk_user_id = user.get("sub")

    project_result = await db.execute(
        select(Project).where(Project.id == body.project_id, Project.clerk_user_id == clerk_user_id)
    )
    project = project_result.scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    # Get user's SSH key - required for pod access
    ssh_key_result = await db.execute(
        select(UserSshKey).where(UserSshKey.clerk_user_id == clerk_user_id)
    )
    ssh_key = ssh_key_result.scalar_one_or_none()

    if not ssh_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No SSH key found. Please generate an SSH key in Settings before creating a run.",
        )

    resolved_config = await resolve_run_config(
        clerk_user_id=clerk_user_id,
        project=project,
        branch=body.branch,
        config_name=body.config_name,
        db=db,
    )

    pod_payload: dict[str, Any] = {
        "name": body.name,
        "cloudId": body.instance.cloud_id,
        "gpuType": body.instance.gpu_type,
        "socket": body.instance.socket,
        "gpuCount": body.instance.gpu_count,
        "image": DEFAULT_IMAGE,
        "dataCenterId": body.instance.data_center,
        "country": body.instance.country,
        "security": body.instance.security,
        "sshKeyId": ssh_key.prime_ssh_key_id,  # Explicitly set SSH key for pod access
    }

    if not body.instance.data_center:
        pod_payload.pop("dataCenterId")
    if not body.instance.country:
        pod_payload.pop("country")

    payload = {
        "pod": pod_payload,
        "provider": {"type": body.instance.provider},
    }

    try:
        raw_response = await create_pod(payload)
    except PrimeIntellectAPIError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)

    pod_response = normalize_pod_response(raw_response)
    pod_id = pod_response.get("pod_id")

    if not pod_id:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Prime Intellect did not return a pod id",
        )

    status_value = pod_response.get("status") or RunStatus.PROVISIONING

    run = Run(
        project_id=project.id,
        clerk_user_id=clerk_user_id,
        name=body.name,
        branch=body.branch,
        config_name=body.config_name,
        status=status_value,
        provider=body.instance.provider,
        region=body.instance.region,
        data_center=body.instance.data_center,
        country=body.instance.country,
        gpu_type=body.instance.gpu_type,
        gpu_count=body.instance.gpu_count,
        security=body.instance.security,
        cloud_id=body.instance.cloud_id,
        pod_id=pod_id,
        is_spot=body.instance.is_spot,
    )

    db.add(run)
    await db.commit()
    await db.refresh(run)

    # Create initial jobs for the run using templates
    ctx = {
        "repo_url": f"https://github.com/{project.repo_owner}/{project.repo_name}.git",
        "branch": resolved_config.branch,
        "config_name": body.config_name,
        "config_path": resolved_config.config_path,
        "env_path": resolved_config.env_path,
        "env_vars": resolved_config.env_vars,
    }
    jobs = create_jobs_from_templates(run.id, clerk_user_id, ctx)
    for job in jobs:
        db.add(job)

    await db.commit()

    return run


@router.get("", response_model=list[RunResponse])
async def list_runs(user: CurrentUser, db: DbSession, project_id: int | None = None):
    clerk_user_id = user.get("sub")
    query = select(Run).where(Run.clerk_user_id == clerk_user_id)

    if project_id is not None:
        query = query.where(Run.project_id == project_id)

    result = await db.execute(query.order_by(Run.created_at.desc()))
    return list(result.scalars().all())


@router.get("/status", response_model=dict[int, RunStatusItem])
async def get_runs_status(
    user: CurrentUser,
    db: DbSession,
    run_ids: list[int] | None = None,
):
    """
    Get the current status of multiple runs.

    This endpoint reads from the database only. Status updates are handled
    by the check_pending_run_statuses Celery Beat task.
    """
    clerk_user_id = user.get("sub")
    if not run_ids:
        return {}

    result = await db.execute(
        select(Run).where(Run.clerk_user_id == clerk_user_id, Run.id.in_(run_ids))
    )
    runs = list(result.scalars().all())

    if not runs:
        return {}

    response: dict[int, RunStatusItem] = {}
    for run in runs:
        response[run.id] = RunStatusItem(
            status=run.status,
            ssh_connection=run.ssh_connection,
        )

    return response


@router.get("/{run_id}", response_model=RunResponse)
async def get_run(run_id: int, user: CurrentUser, db: DbSession):
    clerk_user_id = user.get("sub")
    run = await get_run_or_404(run_id, clerk_user_id, db)
    return run


@router.get("/{run_id}/observability", response_model=RunObservabilityResponse)
async def get_run_observability(run_id: int, user: CurrentUser, db: DbSession):
    """Get persisted run log metadata and surfaced W&B links for a run."""
    clerk_user_id = user.get("sub")
    run = await get_run_or_404(run_id, clerk_user_id, db)

    result = await db.execute(select(RunLogStream).where(RunLogStream.run_id == run_id))
    streams = [
        stream
        for stream in result.scalars().all()
        if is_surfaced_run_log_source(stream.source)
    ]

    source_order = order_run_log_sources([stream.source for stream in streams])
    stream_by_source = {stream.source: stream for stream in streams}
    ordered_streams = [run_log_stream_to_summary(stream_by_source[source]) for source in source_order]

    return RunObservabilityResponse(
        run_id=run.id,
        status=run.status,
        default_source=choose_default_run_log_source(source_order),
        streams=ordered_streams,
        wandb=get_run_wandb_summaries(run),
    )


@router.get("/{run_id}/logs/{source}", response_model=RunLogResponse)
async def get_run_log(
    run_id: int,
    source: str,
    user: CurrentUser,
    db: DbSession,
    after_sequence: int | None = None,
):
    """Get persisted log chunks for a surfaced run log source."""
    clerk_user_id = user.get("sub")
    await get_run_or_404(run_id, clerk_user_id, db)

    stream_result = await db.execute(
        select(RunLogStream).where(
            RunLogStream.run_id == run_id,
            RunLogStream.source == source,
        )
    )
    stream = stream_result.scalar_one_or_none()
    if not stream:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run log not found")

    chunk_query = (
        select(RunLogChunk)
        .where(RunLogChunk.stream_id == stream.id)
        .order_by(RunLogChunk.sequence.asc())
    )
    if after_sequence is not None:
        chunk_query = chunk_query.where(RunLogChunk.sequence > after_sequence)

    chunk_result = await db.execute(chunk_query)
    chunks = list(chunk_result.scalars().all())

    return RunLogResponse(
        run_id=run_id,
        source=stream.source,
        display_name=stream.display_name or get_run_log_source_label(stream.source),
        status=stream.status,
        latest_sequence=stream.last_chunk_sequence,
        chunks=[
            RunLogChunkResponse(
                sequence=chunk.sequence,
                start_offset=chunk.start_offset,
                end_offset=chunk.end_offset,
                content=chunk.content,
                created_at=chunk.created_at,
            )
            for chunk in chunks
        ],
    )


@router.get("/{run_id}/status", response_model=RunStatusResponse)
async def get_run_status(run_id: int, user: CurrentUser, db: DbSession):
    """
    Get the current status of a run.

    This endpoint reads from the database only. Status updates and job triggering
    are handled by the check_pending_run_statuses Celery Beat task.
    """
    clerk_user_id = user.get("sub")
    run = await get_run_or_404(run_id, clerk_user_id, db)

    return RunStatusResponse(
        status=run.status,
        ssh_connection=run.ssh_connection,
    )


@router.post("/{run_id}/terminate", response_model=RunTerminateResponse)
async def terminate_run(run_id: int, user: CurrentUser, db: DbSession):
    clerk_user_id = user.get("sub")
    run = await get_run_or_404(run_id, clerk_user_id, db)

    try:
        await delete_pod(run.pod_id)
    except PrimeIntellectAPIError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)

    task_ids = await cancel_inflight_jobs_for_run(run.id, db)
    run.status = RunStatus.TERMINATED
    run.updated_at = datetime.now(timezone.utc)
    await db.commit()
    revoke_celery_tasks(task_ids)

    return RunTerminateResponse(status=run.status, pod_id=run.pod_id)


@router.post("/{run_id}/sync-jobs", response_model=SyncJobsResponse)
async def sync_jobs(run_id: int, user: CurrentUser, db: DbSession):
    """
    Add missing jobs from the current template to an existing run.

    Compares existing job sequences with the template and adds any
    jobs that don't exist yet. Useful when new jobs are added to the
    template after a run was created.
    """
    clerk_user_id = user.get("sub")

    # Get run and verify ownership
    run = await get_run_or_404(run_id, clerk_user_id, db)

    # Get project for repo info
    project_result = await db.execute(select(Project).where(Project.id == run.project_id))
    project = project_result.scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    # Get existing job sequences for this run
    existing_result = await db.execute(select(Job.sequence).where(Job.run_id == run_id))
    existing_sequences = set(row[0] for row in existing_result.fetchall())

    # Create missing jobs using shared helper
    resolved_config = await resolve_run_config(
        clerk_user_id=clerk_user_id,
        project=project,
        branch=run.branch,
        config_name=run.config_name,
        db=db,
    )

    ctx = {
        "repo_url": f"https://github.com/{project.repo_owner}/{project.repo_name}.git",
        "branch": resolved_config.branch,
        "config_name": run.config_name,
        "config_path": resolved_config.config_path,
        "env_path": resolved_config.env_path,
        "env_vars": resolved_config.env_vars,
    }
    new_jobs = create_jobs_from_templates(run_id, clerk_user_id, ctx, existing_sequences)

    # Add new jobs to database
    for job in new_jobs:
        db.add(job)

    await db.commit()

    if new_jobs:
        return SyncJobsResponse(
            added_count=len(new_jobs),
            message=f"Added {len(new_jobs)} new job(s)",
        )
    else:
        return SyncJobsResponse(
            added_count=0,
            message="All jobs are already present",
        )
