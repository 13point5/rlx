from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from database import Job, JobStatus, JobType, Project, Run, RunStatus
from deps import CurrentUser, DbSession
from services.prime_intellect import (
    DEFAULT_IMAGE,
    PrimeIntellectAPIError,
    create_pod,
    delete_pod,
    fetch_pod_status,
    normalize_pod_response,
)

router = APIRouter(prefix="/api/runs", tags=["runs"])


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
    ip: str | None = None


class RunTerminateResponse(BaseModel):
    status: str
    pod_id: str


class RunStatusItem(BaseModel):
    status: str
    ssh_connection: str | None = None
    ip: str | None = None


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

    # Create initial jobs for the run
    # Job 1: Clone the repository
    repo_url = f"https://github.com/{project.repo_owner}/{project.repo_name}.git"
    clone_job = Job(
        run_id=run.id,
        clerk_user_id=clerk_user_id,
        job_type=JobType.CLONE_REPO,
        job_config={
            "repo_url": repo_url,
            "branch": body.branch,
            "target_dir": "/workspace/repo",
            "depth": 1,  # Shallow clone for speed
        },
        status=JobStatus.PENDING,
        sequence=0,
    )
    db.add(clone_job)

    # Job 2: List files after clone
    list_job = Job(
        run_id=run.id,
        clerk_user_id=clerk_user_id,
        job_type=JobType.LIST_FILES,
        job_config={
            "target_dir": "/workspace/repo",
        },
        status=JobStatus.PENDING,
        sequence=1,
    )
    db.add(list_job)

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
    clerk_user_id = user.get("sub")
    if not run_ids:
        return {}

    result = await db.execute(
        select(Run).where(Run.clerk_user_id == clerk_user_id, Run.id.in_(run_ids))
    )
    runs = list(result.scalars().all())

    if not runs:
        return {}

    pod_ids = [run.pod_id for run in runs]

    try:
        status_payload = await fetch_pod_status(pod_ids)
    except PrimeIntellectAPIError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)

    status_entries = _extract_status_entries(status_payload)
    if not status_entries:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Prime Intellect did not return pod status",
        )

    # Normalize entries and create a map keyed by pod_id
    normalized_entries = [normalize_pod_response(entry) for entry in status_entries]
    status_map = {entry["pod_id"]: entry for entry in normalized_entries if entry["pod_id"]}

    response: dict[int, RunStatusItem] = {}

    for run in runs:
        if run.status == RunStatus.TERMINATED:
            response[run.id] = RunStatusItem(status=run.status, ssh_connection=None, ip=None)
            continue

        status_data = status_map.get(run.pod_id)
        if not status_data:
            response[run.id] = RunStatusItem(status=run.status, ssh_connection=None, ip=None)
            continue
        status_value = status_data.get("status") or run.status
        ssh_connection = status_data.get("ssh_connection")
        ip_address = status_data.get("ip")

        run.status = status_value
        run.updated_at = datetime.now(timezone.utc)

        response[run.id] = RunStatusItem(
            status=status_value,
            ssh_connection=ssh_connection,
            ip=ip_address,
        )

    await db.commit()

    return response


@router.get("/{run_id}", response_model=RunResponse)
async def get_run(run_id: int, user: CurrentUser, db: DbSession):
    clerk_user_id = user.get("sub")
    run = await get_run_or_404(run_id, clerk_user_id, db)
    return run


def _extract_status_entries(payload: Any) -> list[dict[str, Any]]:
    """
    Extract status entries from various Prime Intellect API response formats.

    The API can return:
    - A list of entries directly
    - A dict with a "data" key containing a list
    - A single dict entry
    """
    if payload is None:
        return []
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        data = payload.get("data", payload)
        return data if isinstance(data, list) else [data]
    return []


def _extract_single_status(payload: Any) -> dict[str, Any] | None:
    """Extract a single status entry from the payload."""
    entries = _extract_status_entries(payload)
    return entries[0] if entries else None


@router.get("/{run_id}/status", response_model=RunStatusResponse)
async def get_run_status(run_id: int, user: CurrentUser, db: DbSession):
    clerk_user_id = user.get("sub")
    run = await get_run_or_404(run_id, clerk_user_id, db)

    if run.status == RunStatus.TERMINATED:
        return RunStatusResponse(status=run.status, ssh_connection=None, ip=None)

    def _raise_prime_error(message: str, status_code: int) -> None:
        raise HTTPException(
            status_code=status_code,
            detail={
                "message": message,
                "last_known_status": run.status,
                "last_updated_at": run.updated_at.isoformat() if run.updated_at else None,
            },
        )

    try:
        status_payload = await fetch_pod_status([run.pod_id])
    except PrimeIntellectAPIError as exc:
        _raise_prime_error(exc.message, exc.status_code)

    raw_status_data = _extract_single_status(status_payload)

    if not raw_status_data:
        _raise_prime_error(
            "Prime Intellect did not return pod status",
            status.HTTP_502_BAD_GATEWAY,
        )

    status_data = normalize_pod_response(raw_status_data)
    status_value = status_data.get("status")
    if not status_value:
        _raise_prime_error(
            "Prime Intellect did not return status",
            status.HTTP_502_BAD_GATEWAY,
        )

    ssh_connection = status_data.get("ssh_connection")
    ip_address = status_data.get("ip")

    # Check if status changed to ACTIVE
    previous_status = run.status
    run.status = status_value
    run.updated_at = datetime.now(timezone.utc)
    await db.commit()

    # Trigger job processing if pod just became active
    if previous_status != RunStatus.ACTIVE and status_value == RunStatus.ACTIVE:
        try:
            from celery_app.tasks.pod_tasks import on_pod_ready

            on_pod_ready.delay(run_id)
        except Exception as e:
            # Log but don't fail the status request
            import logging

            logging.warning(f"Failed to trigger job processing for run {run_id}: {e}")

    return RunStatusResponse(
        status=status_value,
        ssh_connection=ssh_connection,
        ip=ip_address,
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
