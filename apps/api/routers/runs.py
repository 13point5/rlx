"""API endpoints for managing training runs."""

from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from database import Project, Run
from deps import CurrentUser, DbSession
from services.prime_intellect import PrimeIntellectAPIError, delete_pod

router = APIRouter(prefix="/api/runs", tags=["runs"])


class CreateRunRequest(BaseModel):
    """Request model for creating a new run."""

    project_id: int
    name: str
    gpu_type: str
    gpu_count: int
    cloud_id: str
    provider: str
    region: str | None = None
    data_center_id: str | None = None


class RunResponse(BaseModel):
    """Response model for run information."""

    id: int
    project_id: int
    name: str
    gpu_type: str
    gpu_count: int
    cloud_id: str
    provider: str
    region: str | None
    data_center_id: str | None
    pod_id: str | None
    status: str
    error_message: str | None
    ssh_connection: str | None
    ip_address: str | None
    cost_per_hr: str | None
    installation_progress: int
    clone_status: str
    clone_error: str | None
    created_at: str
    updated_at: str
    terminated_at: str | None


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_run(
    request: CreateRunRequest,
    user: CurrentUser,
    db: DbSession,
) -> Dict[str, Any]:
    """
    Create a new training run.

    This will:
    1. Create a run record in the database
    2. Trigger background provisioning of the GPU instance
    3. Once provisioned, automatically clone the project's repository
    """
    # Verify project exists and belongs to user
    result = await db.execute(
        select(Project).where(
            Project.id == request.project_id, Project.clerk_user_id == user["sub"]
        )
    )
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    # Create run record
    run = Run(
        clerk_user_id=user["sub"],
        project_id=request.project_id,
        name=request.name,
        gpu_type=request.gpu_type,
        gpu_count=request.gpu_count,
        cloud_id=request.cloud_id,
        provider=request.provider,
        region=request.region,
        data_center_id=request.data_center_id,
        status="pending",
        installation_progress=0,
        clone_status="pending",
    )

    db.add(run)
    await db.commit()
    await db.refresh(run)

    return {
        "success": True,
        "data": _run_to_dict(run),
        "message": "Run created. GPU provisioning will begin shortly.",
    }


@router.get("/{run_id}")
async def get_run(
    run_id: int,
    user: CurrentUser,
    db: DbSession,
) -> Dict[str, Any]:
    """Get details of a specific run."""
    result = await db.execute(
        select(Run).where(Run.id == run_id, Run.clerk_user_id == user["sub"])
    )
    run = result.scalar_one_or_none()

    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Run not found",
        )

    return {"success": True, "data": _run_to_dict(run)}


@router.get("/")
async def list_runs(
    user: CurrentUser,
    db: DbSession,
    project_id: int | None = None,
) -> Dict[str, Any]:
    """
    List all runs for the authenticated user.

    Optionally filter by project_id.
    """
    query = select(Run).where(Run.clerk_user_id == user["sub"])

    if project_id is not None:
        query = query.where(Run.project_id == project_id)

    # Order by most recent first
    query = query.order_by(Run.created_at.desc())

    result = await db.execute(query)
    runs = result.scalars().all()

    return {
        "success": True,
        "data": [_run_to_dict(run) for run in runs],
    }


@router.delete("/{run_id}")
async def delete_run(
    run_id: int,
    user: CurrentUser,
    db: DbSession,
) -> Dict[str, Any]:
    """
    Delete/terminate a run.

    This will:
    1. Delete the GPU pod (if it exists)
    2. Mark the run as terminated in the database
    """
    result = await db.execute(
        select(Run).where(Run.id == run_id, Run.clerk_user_id == user["sub"])
    )
    run = result.scalar_one_or_none()

    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Run not found",
        )

    # If there's a pod, delete it
    if run.pod_id and run.status not in ["terminated", "failed"]:
        try:
            await delete_pod(run.pod_id)
        except PrimeIntellectAPIError as e:
            # Log error but continue with database update
            print(f"Error deleting pod {run.pod_id}: {e}")

    # Update run status
    run.status = "terminated"
    run.terminated_at = datetime.now(timezone.utc)
    await db.commit()

    return {
        "success": True,
        "message": "Run terminated successfully",
    }


def _run_to_dict(run: Run) -> Dict[str, Any]:
    """Convert Run model to dictionary for API response."""
    return {
        "id": run.id,
        "project_id": run.project_id,
        "name": run.name,
        "gpu_type": run.gpu_type,
        "gpu_count": run.gpu_count,
        "cloud_id": run.cloud_id,
        "provider": run.provider,
        "region": run.region,
        "data_center_id": run.data_center_id,
        "pod_id": run.pod_id,
        "status": run.status,
        "error_message": run.error_message,
        "ssh_connection": run.ssh_connection,
        "ip_address": run.ip_address,
        "cost_per_hr": run.cost_per_hr,
        "installation_progress": run.installation_progress,
        "clone_status": run.clone_status,
        "clone_error": run.clone_error,
        "created_at": run.created_at.isoformat() if run.created_at else None,
        "updated_at": run.updated_at.isoformat() if run.updated_at else None,
        "terminated_at": run.terminated_at.isoformat() if run.terminated_at else None,
    }
