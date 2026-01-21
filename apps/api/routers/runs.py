from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from database import Job, Project, Run, RunStatus, UserSshKey
from deps import CurrentUser, DbSession
from job_templates import create_jobs_from_templates
from services.prime_intellect import (
    DEFAULT_IMAGE,
    PrimeIntellectAPIError,
    create_pod,
    delete_pod,
    normalize_pod_response,
)

router = APIRouter(prefix="/api/runs", tags=["runs"])


def strip_origin_prefix(branch: str) -> str:
    """
    Strip 'origin/' prefix from a branch name for git clone.

    The UI sends branches as 'origin/main' for display purposes,
    but git clone --branch expects just 'main'.
    """
    if branch.startswith("origin/"):
        return branch[7:]  # len("origin/") == 7
    return branch


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
    config_path: str
    instance: InstanceSelection


class RunResponse(BaseModel):
    id: int
    project_id: int
    name: str
    branch: str
    config_path: str
    status: str
    provider: str
    region: str
    data_center: str | None
    country: str | None
    gpu_type: str
    gpu_count: int
    security: str
    cloud_id: str
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


async def get_run_or_404(run_id: int, clerk_user_id: str, db: DbSession) -> Run:
    result = await db.execute(
        select(Run).where(Run.id == run_id, Run.clerk_user_id == clerk_user_id)
    )
    run = result.scalar_one_or_none()

    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")

    return run


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
        config_path=body.config_path,
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
        "branch": strip_origin_prefix(body.branch),
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

    run.status = RunStatus.TERMINATED
    run.updated_at = datetime.now(timezone.utc)
    await db.commit()

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
    ctx = {
        "repo_url": f"https://github.com/{project.repo_owner}/{project.repo_name}.git",
        "branch": strip_origin_prefix(run.branch),
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
