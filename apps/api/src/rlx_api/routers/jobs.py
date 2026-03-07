"""Jobs API router."""

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from rlx_api.database import Job, JobCommand, JobStatus, JobType, Run, RunStatus
from rlx_api.deps import CurrentUser, DbSession

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


# Request/Response Models


class CreateJobRequest(BaseModel):
    """Request to create a new job."""

    run_id: int
    job_type: str  # JobType value
    config: dict[str, Any]


class JobResponse(BaseModel):
    """Job response model."""

    id: int
    run_id: int
    job_type: str
    status: str
    config: dict[str, Any]
    celery_task_id: str | None
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None
    error_message: str | None
    error_type: str | None
    sequence: int

    class Config:
        from_attributes = True


class JobCommandResponse(BaseModel):
    """Job command response model."""

    id: int
    command: str
    working_dir: str | None
    stdout: str | None
    stderr: str | None
    exit_code: int | None
    status: str
    started_at: datetime | None
    completed_at: datetime | None
    duration_ms: int | None
    sequence: int

    class Config:
        from_attributes = True


class JobDetailResponse(BaseModel):
    """Detailed job response with commands."""

    id: int
    run_id: int
    job_type: str
    status: str
    config: dict[str, Any]
    celery_task_id: str | None
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None
    error_message: str | None
    error_type: str | None
    sequence: int
    commands: list[JobCommandResponse]


class JobResultResponse(BaseModel):
    """Job result response."""

    job_id: int
    job_type: str
    status: str
    result: dict[str, Any] | None


# Helper Functions


def job_to_response(job: Job) -> JobResponse:
    """Convert Job model to response."""
    return JobResponse(
        id=job.id,
        run_id=job.run_id,
        job_type=job.job_type,
        status=job.status,
        config=job.job_config,
        celery_task_id=job.celery_task_id,
        created_at=job.created_at,
        started_at=job.started_at,
        completed_at=job.completed_at,
        error_message=job.error_message,
        error_type=job.error_type,
        sequence=job.sequence,
    )


# Endpoints


@router.post("", status_code=status.HTTP_201_CREATED, response_model=JobResponse)
async def create_job(body: CreateJobRequest, user: CurrentUser, db: DbSession):
    """
    Create a new job for a run.
    Job will start automatically when the pod is ready.
    """
    clerk_user_id = user.get("sub")

    # Verify run exists and belongs to user
    result = await db.execute(
        select(Run).where(Run.id == body.run_id, Run.clerk_user_id == clerk_user_id)
    )
    run = result.scalar_one_or_none()

    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Run not found",
        )

    # Validate job type
    valid_types = [e.value for e in JobType]
    if body.job_type not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid job type. Must be one of: {valid_types}",
        )

    # Validate required config fields based on job type
    if body.job_type == JobType.CLONE_REPO and "repo_url" not in body.config:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="repo_url is required for CLONE_REPO jobs",
        )
    if body.job_type == JobType.CUSTOM_COMMAND and "command" not in body.config:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="command is required for CUSTOM_COMMAND jobs",
        )

    # Get next sequence number
    seq_result = await db.execute(
        select(Job.sequence).where(Job.run_id == body.run_id).order_by(Job.sequence.desc()).limit(1)
    )
    last_seq = seq_result.scalar_one_or_none()
    next_seq = (last_seq or -1) + 1

    job = Job(
        run_id=body.run_id,
        clerk_user_id=clerk_user_id,
        job_type=body.job_type,
        job_config=body.config,
        status=JobStatus.PENDING,
        sequence=next_seq,
    )

    db.add(job)
    await db.commit()
    await db.refresh(job)

    return job_to_response(job)


@router.get("", response_model=list[JobResponse])
async def list_jobs(
    user: CurrentUser,
    db: DbSession,
    run_id: int | None = None,
    status: str | None = None,
):
    """List jobs for the current user, optionally filtered by run or status."""
    clerk_user_id = user.get("sub")

    query = select(Job).where(Job.clerk_user_id == clerk_user_id)

    if run_id is not None:
        query = query.where(Job.run_id == run_id)
    if status is not None:
        query = query.where(Job.status == status)

    query = query.order_by(Job.created_at.desc())

    result = await db.execute(query)
    jobs = list(result.scalars().all())

    return [job_to_response(job) for job in jobs]


@router.get("/{job_id}", response_model=JobDetailResponse)
async def get_job(job_id: int, user: CurrentUser, db: DbSession):
    """Get job details including command history."""
    clerk_user_id = user.get("sub")

    result = await db.execute(
        select(Job).where(Job.id == job_id, Job.clerk_user_id == clerk_user_id)
    )
    job = result.scalar_one_or_none()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    # Get associated commands
    cmd_result = await db.execute(
        select(JobCommand).where(JobCommand.job_id == job_id).order_by(JobCommand.sequence)
    )
    commands = list(cmd_result.scalars().all())

    return JobDetailResponse(
        id=job.id,
        run_id=job.run_id,
        job_type=job.job_type,
        status=job.status,
        config=job.job_config,
        celery_task_id=job.celery_task_id,
        created_at=job.created_at,
        started_at=job.started_at,
        completed_at=job.completed_at,
        error_message=job.error_message,
        error_type=job.error_type,
        sequence=job.sequence,
        commands=[
            JobCommandResponse(
                id=cmd.id,
                command=cmd.command,
                working_dir=cmd.working_dir,
                stdout=cmd.stdout,
                stderr=cmd.stderr,
                exit_code=cmd.exit_code,
                status=cmd.status,
                started_at=cmd.started_at,
                completed_at=cmd.completed_at,
                duration_ms=cmd.duration_ms,
                sequence=cmd.sequence,
            )
            for cmd in commands
        ],
    )


@router.post("/{job_id}/cancel", response_model=JobResponse)
async def cancel_job(job_id: int, user: CurrentUser, db: DbSession):
    """Cancel a pending or queued job."""
    clerk_user_id = user.get("sub")

    result = await db.execute(
        select(Job).where(Job.id == job_id, Job.clerk_user_id == clerk_user_id)
    )
    job = result.scalar_one_or_none()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    cancellable_statuses = [JobStatus.PENDING, JobStatus.QUEUED]
    if job.status not in cancellable_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel job with status {job.status}. Only PENDING or QUEUED jobs can be cancelled.",
        )

    # Revoke Celery task if queued
    if job.celery_task_id:
        try:
            from rlx_api.celery_app import celery_app

            celery_app.control.revoke(job.celery_task_id, terminate=True)
        except Exception as e:
            # Log but don't fail - job may not have started yet
            import logging

            logging.warning(f"Failed to revoke Celery task {job.celery_task_id}: {e}")

    job.status = JobStatus.CANCELLED
    job.completed_at = datetime.now(timezone.utc)
    await db.commit()

    return job_to_response(job)


@router.get("/{job_id}/result", response_model=JobResultResponse)
async def get_job_result(job_id: int, user: CurrentUser, db: DbSession):
    """Get the result of a completed job (e.g., file listing)."""
    clerk_user_id = user.get("sub")

    result = await db.execute(
        select(Job).where(Job.id == job_id, Job.clerk_user_id == clerk_user_id)
    )
    job = result.scalar_one_or_none()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    # Return result regardless of status - let client decide what to do
    job_result = job.job_config.get("result") if job.job_config else None

    return JobResultResponse(
        job_id=job.id,
        job_type=job.job_type,
        status=job.status,
        result=job_result,
    )


@router.post("/{job_id}/retry", response_model=JobResponse)
async def retry_job(job_id: int, user: CurrentUser, db: DbSession):
    """Retry a failed or cancelled job."""
    clerk_user_id = user.get("sub")

    result = await db.execute(
        select(Job).where(Job.id == job_id, Job.clerk_user_id == clerk_user_id)
    )
    job = result.scalar_one_or_none()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    run_result = await db.execute(
        select(Run).where(Run.id == job.run_id, Run.clerk_user_id == clerk_user_id)
    )
    run = run_result.scalar_one_or_none()

    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Run not found",
        )

    non_retryable_run_statuses = [RunStatus.TERMINATED, RunStatus.STOPPED, RunStatus.ERROR]
    if run.status in non_retryable_run_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot retry a job for a run with status {run.status}. "
                "Create a new run instead."
            ),
        )

    retryable_statuses = [JobStatus.FAILED, JobStatus.CANCELLED, JobStatus.TIMEOUT]
    if job.status not in retryable_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot retry job with status {job.status}. Only FAILED, CANCELLED, or TIMEOUT jobs can be retried.",
        )

    # Reset job status
    job.status = JobStatus.PENDING
    job.celery_task_id = None
    job.started_at = None
    job.completed_at = None
    job.error_message = None
    job.error_type = None

    # Clear result from config if present
    if job.job_config and "result" in job.job_config:
        config = dict(job.job_config)
        del config["result"]
        job.job_config = config

    await db.commit()
    await db.refresh(job)

    return job_to_response(job)
