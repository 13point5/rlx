from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from database import Project, Run
from deps import CurrentUser, DbSession
from services.prime_intellect import (
    DEFAULT_IMAGE,
    PrimeIntellectAPIError,
    create_pod,
    delete_pod,
    fetch_pod_status,
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


class RunStatusErrorResponse(BaseModel):
    message: str
    last_known_status: str
    last_updated_at: datetime | None = None


class RunTerminateResponse(BaseModel):
    status: str
    pod_id: str


async def get_run_or_404(run_id: int, clerk_user_id: str, db: DbSession) -> Run:
    result = await db.execute(
        select(Run).where(Run.id == run_id, Run.clerk_user_id == clerk_user_id)
    )
    run = result.scalar_one_or_none()

    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Run not found"
        )

    return run


@router.post("", status_code=status.HTTP_201_CREATED, response_model=RunResponse)
async def create_run(body: CreateRunRequest, user: CurrentUser, db: DbSession):
    clerk_user_id = user.get("sub")

    project_result = await db.execute(
        select(Project).where(
            Project.id == body.project_id, Project.clerk_user_id == clerk_user_id
        )
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
        pod_response = await create_pod(payload)
    except PrimeIntellectAPIError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)

    pod_id = (
        pod_response.get("id")
        or pod_response.get("podId")
        or pod_response.get("pod_id")
    )

    if not pod_id:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Prime Intellect did not return a pod id",
        )

    status_value = pod_response.get("status") or "PROVISIONING"

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

    return run


@router.get("/{run_id}", response_model=RunResponse)
async def get_run(run_id: int, user: CurrentUser, db: DbSession):
    clerk_user_id = user.get("sub")
    run = await get_run_or_404(run_id, clerk_user_id, db)
    return run


def _extract_status_payload(payload: Any) -> dict[str, Any] | None:
    if payload is None:
        return None
    if isinstance(payload, list):
        return payload[0] if payload else None
    if isinstance(payload, dict) and "data" in payload:
        data = payload["data"]
        if isinstance(data, list):
            return data[0] if data else None
        if isinstance(data, dict):
            return data
    if isinstance(payload, dict):
        return payload
    return None


@router.get("/{run_id}/status", response_model=RunStatusResponse)
async def get_run_status(run_id: int, user: CurrentUser, db: DbSession):
    clerk_user_id = user.get("sub")
    run = await get_run_or_404(run_id, clerk_user_id, db)

    if run.status == "TERMINATED":
        return RunStatusResponse(status=run.status, ssh_connection=None, ip=None)

    def _raise_prime_error(message: str, status_code: int) -> None:
        raise HTTPException(
            status_code=status_code,
            detail={
                "message": message,
                "last_known_status": run.status,
                "last_updated_at": run.updated_at.isoformat()
                if run.updated_at
                else None,
            },
        )

    try:
        status_payload = await fetch_pod_status([run.pod_id])
    except PrimeIntellectAPIError as exc:
        _raise_prime_error(exc.message, exc.status_code)

    status_data = _extract_status_payload(status_payload)

    if not status_data:
        _raise_prime_error(
            "Prime Intellect did not return pod status",
            status.HTTP_502_BAD_GATEWAY,
        )

    status_value = status_data.get("status")
    if not status_value:
        _raise_prime_error(
            "Prime Intellect did not return status",
            status.HTTP_502_BAD_GATEWAY,
        )

    ssh_connection = status_data.get("sshConnection") or status_data.get(
        "ssh_connection"
    )
    ip_address = status_data.get("ip")

    run.status = status_value
    run.updated_at = datetime.now(timezone.utc)
    await db.commit()

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

    run.status = "TERMINATED"
    run.updated_at = datetime.now(timezone.utc)
    await db.commit()

    return RunTerminateResponse(status=run.status, pod_id=run.pod_id)
