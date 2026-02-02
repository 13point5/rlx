"""Jobs API router."""

import asyncio
import json
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select

from database import Job, JobCommand, JobLog, JobLogOffset, JobStatus, JobType, LogType, Run
from deps import CurrentUser, DbSession

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


class JobLogEntryResponse(BaseModel):
    """Single log entry response."""

    id: int
    log_type: str
    content: str
    byte_offset: int
    captured_at: datetime

    class Config:
        from_attributes = True


class JobLogsResponse(BaseModel):
    """Job logs response with all log types."""

    job_id: int
    logs: list[JobLogEntryResponse]
    offsets: dict[str, int]  # Current offset per log type


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
            from celery_app import celery_app

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


@router.get("/{job_id}/logs", response_model=JobLogsResponse)
async def get_job_logs(
    job_id: int,
    user: CurrentUser,
    db: DbSession,
    log_type: str | None = None,
    after_id: int | None = None,
    limit: int = 100,
):
    """
    Get logs for a job.

    Args:
        job_id: The job ID
        log_type: Optional filter by log type (trainer, orchestrator, inference, rl)
        after_id: Optional ID to fetch logs after (for pagination/streaming)
        limit: Maximum number of log entries to return (default 100)
    """
    clerk_user_id = user.get("sub")

    # Verify job exists and belongs to user
    result = await db.execute(
        select(Job).where(Job.id == job_id, Job.clerk_user_id == clerk_user_id)
    )
    job = result.scalar_one_or_none()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    # Validate log type if provided
    if log_type is not None:
        valid_types = [e.value for e in LogType]
        if log_type not in valid_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid log type. Must be one of: {valid_types}",
            )

    # Build query for logs
    query = select(JobLog).where(JobLog.job_id == job_id)

    if log_type is not None:
        query = query.where(JobLog.log_type == log_type)

    if after_id is not None:
        query = query.where(JobLog.id > after_id)

    query = query.order_by(JobLog.id).limit(limit)

    log_result = await db.execute(query)
    logs = list(log_result.scalars().all())

    # Get current offsets
    offset_result = await db.execute(
        select(JobLogOffset).where(JobLogOffset.job_id == job_id)
    )
    offset_records = list(offset_result.scalars().all())
    offsets = {record.log_type: record.byte_offset for record in offset_records}

    return JobLogsResponse(
        job_id=job_id,
        logs=[
            JobLogEntryResponse(
                id=log.id,
                log_type=log.log_type,
                content=log.content,
                byte_offset=log.byte_offset,
                captured_at=log.captured_at,
            )
            for log in logs
        ],
        offsets=offsets,
    )


@router.post("/{job_id}/logs/refresh")
async def refresh_job_logs(job_id: int, user: CurrentUser, db: DbSession):
    """
    Trigger a manual log refresh for a job.
    Useful when logs haven't been streaming automatically.
    """
    clerk_user_id = user.get("sub")

    # Verify job exists and belongs to user
    result = await db.execute(
        select(Job).where(Job.id == job_id, Job.clerk_user_id == clerk_user_id)
    )
    job = result.scalar_one_or_none()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    # Trigger log fetch task
    from celery_app.tasks.log_tasks import fetch_logs_once

    task = fetch_logs_once.delay(job_id)

    return {"message": "Log refresh triggered", "task_id": task.id}


@router.get("/{job_id}/logs/stream")
async def stream_job_logs_sse(
    job_id: int,
    user: CurrentUser,
    db: DbSession,
    log_type: str | None = None,
    after_id: int = 0,
):
    """
    Stream logs for a job using Server-Sent Events (SSE).

    The client should connect to this endpoint and receive log entries as they become available.
    Each event contains a JSON payload with the log entry data.

    Args:
        job_id: The job ID
        log_type: Optional filter by log type (trainer, orchestrator, inference, rl)
        after_id: Start streaming from logs after this ID (default 0 = from beginning)
    """
    clerk_user_id = user.get("sub")

    # Verify job exists and belongs to user
    result = await db.execute(
        select(Job).where(Job.id == job_id, Job.clerk_user_id == clerk_user_id)
    )
    job = result.scalar_one_or_none()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    # Validate log type if provided
    if log_type is not None:
        valid_types = [e.value for e in LogType]
        if log_type not in valid_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid log type. Must be one of: {valid_types}",
            )

    async def event_generator():
        """Generate SSE events for log entries."""
        last_id = after_id
        consecutive_empty = 0
        max_empty_polls = 60  # Stop after 60 empty polls (5 minutes at 5s interval)

        while True:
            # Check if job is still running
            result = await db.execute(select(Job.status).where(Job.id == job_id))
            current_status = result.scalar_one_or_none()

            # Build query for new logs
            query = select(JobLog).where(JobLog.job_id == job_id, JobLog.id > last_id)

            if log_type is not None:
                query = query.where(JobLog.log_type == log_type)

            query = query.order_by(JobLog.id).limit(50)

            log_result = await db.execute(query)
            logs = list(log_result.scalars().all())

            if logs:
                consecutive_empty = 0
                for log in logs:
                    event_data = {
                        "id": log.id,
                        "log_type": log.log_type,
                        "content": log.content,
                        "byte_offset": log.byte_offset,
                        "captured_at": log.captured_at.isoformat() if log.captured_at else None,
                    }
                    yield f"id: {log.id}\ndata: {json.dumps(event_data)}\n\n"
                    last_id = log.id
            else:
                consecutive_empty += 1

            # Send heartbeat to keep connection alive
            yield f": heartbeat {datetime.now(timezone.utc).isoformat()}\n\n"

            # Stop conditions
            if current_status and current_status not in [JobStatus.RUNNING, JobStatus.QUEUED]:
                # Job finished - do one more poll then stop
                await asyncio.sleep(2)
                # Final poll
                log_result = await db.execute(
                    select(JobLog)
                    .where(JobLog.job_id == job_id, JobLog.id > last_id)
                    .order_by(JobLog.id)
                )
                final_logs = list(log_result.scalars().all())
                for log in final_logs:
                    event_data = {
                        "id": log.id,
                        "log_type": log.log_type,
                        "content": log.content,
                        "byte_offset": log.byte_offset,
                        "captured_at": log.captured_at.isoformat() if log.captured_at else None,
                    }
                    yield f"id: {log.id}\ndata: {json.dumps(event_data)}\n\n"

                # Send done event
                yield f"event: done\ndata: {json.dumps({'status': current_status})}\n\n"
                break

            if consecutive_empty >= max_empty_polls:
                # Too many empty polls - likely no more logs coming
                yield f"event: timeout\ndata: {json.dumps({'message': 'No new logs for 5 minutes'})}\n\n"
                break

            await asyncio.sleep(5)  # Poll every 5 seconds

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )
