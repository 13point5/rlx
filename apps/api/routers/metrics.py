"""
Prime-RL compatible metrics logging endpoints.

These endpoints are designed to be compatible with PrimeMonitor from prime-rl.
Configure PrimeMonitor with:
    base_url = "https://your-api.com/api/rft"
    api_key_var = "RLX_API_KEY"  # or use x-api-key header

The RUN_ID environment variable should be set to the run ID in your database.
"""

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select

from database import (
    Run,
    RunDistribution,
    RunFinalizedStatus,
    RunMetrics,
    RunSample,
    RunSummary,
)
from deps import DbSession

router = APIRouter(prefix="/api/rft", tags=["metrics"])


# ============================================================================
# Request/Response Models (Compatible with PrimeMonitor)
# ============================================================================


class LogMetricsRequest(BaseModel):
    """Request body for logging metrics (from PrimeMonitor.log())."""

    run_id: str
    metrics: dict[str, Any]


class LogSampleItem(BaseModel):
    """Single sample in a log_samples request."""

    step: int | None = None
    example_id: str | None = None
    prompt: Any | None = None
    completion: Any | None = None
    trajectory: list[dict[str, Any]] | None = None
    reward: float | None = None
    advantage: float | None = None
    answer: str | None = None
    task: str | None = None
    info: dict[str, Any] | None = None
    metrics: dict[str, Any] | None = None
    timing: dict[str, Any] | None = None


class LogSamplesRequest(BaseModel):
    """Request body for logging samples (from PrimeMonitor.log_samples())."""

    run_id: str
    step: int
    samples: list[LogSampleItem]


class LogDistributionsRequest(BaseModel):
    """Request body for logging distributions (from PrimeMonitor.log_distributions())."""

    run_id: str
    step: int
    distributions: dict[str, list[float]]


class FinalizeRequest(BaseModel):
    """Request body for finalizing a run (from PrimeMonitor.save_final_summary())."""

    run_id: str
    summary: dict[str, Any]


class SuccessResponse(BaseModel):
    """Standard success response."""

    success: bool = True
    message: str = "OK"


# ============================================================================
# Response Models for Querying
# ============================================================================


class MetricsResponse(BaseModel):
    """Response for querying metrics."""

    run_id: int
    data: list[dict[str, Any]]


class MetricSeriesPoint(BaseModel):
    """Single point in a metric time series."""

    step: int | None
    value: float
    timestamp: datetime


class MetricSeriesResponse(BaseModel):
    """Response for a single metric time series."""

    run_id: int
    metric_name: str
    data: list[MetricSeriesPoint]


class SampleResponse(BaseModel):
    """Single sample response."""

    id: int
    step: int
    example_id: str | None
    prompt: Any | None
    completion: Any | None
    trajectory: list[dict[str, Any]] | None
    reward: float | None
    advantage: float | None
    answer: str | None
    task: str | None
    info: dict[str, Any] | None
    metrics: dict[str, Any] | None
    timing: dict[str, Any] | None
    created_at: datetime


class SamplesListResponse(BaseModel):
    """Response for listing samples."""

    run_id: int
    total: int
    samples: list[SampleResponse]


class DistributionResponse(BaseModel):
    """Response for a distribution at a step."""

    step: int
    distributions: dict[str, list[float]]
    created_at: datetime


class DistributionsListResponse(BaseModel):
    """Response for listing distributions."""

    run_id: int
    data: list[DistributionResponse]


class AvailableMetricsResponse(BaseModel):
    """Response listing available metric names for a run."""

    run_id: int
    metrics: list[str]


# ============================================================================
# Logging Endpoints (PrimeMonitor Compatible)
# ============================================================================


async def validate_run_id(run_id: str, db: DbSession) -> int:
    """Validate and parse run_id, returning the integer ID."""
    try:
        run_id_int = int(run_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid run_id: {run_id}. Must be an integer.",
        )

    result = await db.execute(select(Run).where(Run.id == run_id_int))
    run = result.scalar_one_or_none()

    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Run {run_id} not found",
        )

    return run_id_int


async def validate_api_key(x_api_key: str | None) -> None:
    """Validate API key header. For now, just check it exists."""
    # TODO: Implement proper API key validation
    # For now, we accept any non-empty key or no key at all (for local dev)
    pass


@router.post("/metrics", response_model=SuccessResponse)
async def log_metrics(
    body: LogMetricsRequest,
    db: DbSession,
    x_api_key: str | None = Header(None),
):
    """
    Log scalar metrics for a training run.

    Compatible with PrimeMonitor.log() method.
    Expects: {"run_id": "123", "metrics": {"loss": 0.5, "reward": 1.0, ...}}
    """
    await validate_api_key(x_api_key)
    run_id = await validate_run_id(body.run_id, db)

    # Extract step from metrics if present
    step = body.metrics.get("step")

    metrics_record = RunMetrics(
        run_id=run_id,
        step=step,
        metrics=body.metrics,
    )

    db.add(metrics_record)
    await db.commit()

    return SuccessResponse(message=f"Logged metrics for run {run_id}")


@router.post("/samples", response_model=SuccessResponse)
async def log_samples(
    body: LogSamplesRequest,
    db: DbSession,
    x_api_key: str | None = Header(None),
):
    """
    Log sample/rollout data for a training run.

    Compatible with PrimeMonitor.log_samples() method.
    Expects: {"run_id": "123", "step": 100, "samples": [...]}
    """
    await validate_api_key(x_api_key)
    run_id = await validate_run_id(body.run_id, db)

    for sample in body.samples:
        sample_record = RunSample(
            run_id=run_id,
            step=body.step,
            example_id=sample.example_id,
            prompt=sample.prompt,
            completion=sample.completion,
            trajectory=sample.trajectory,
            reward=sample.reward,
            advantage=sample.advantage,
            answer=sample.answer,
            task=sample.task,
            info=sample.info,
            sample_metrics=sample.metrics,
            timing=sample.timing,
        )
        db.add(sample_record)

    await db.commit()

    return SuccessResponse(message=f"Logged {len(body.samples)} samples for run {run_id} at step {body.step}")


@router.post("/distributions", response_model=SuccessResponse)
async def log_distributions(
    body: LogDistributionsRequest,
    db: DbSession,
    x_api_key: str | None = Header(None),
):
    """
    Log distribution data (rewards, advantages) for a training run.

    Compatible with PrimeMonitor.log_distributions() method.
    Expects: {"run_id": "123", "step": 100, "distributions": {"rewards": [...], "advantages": [...]}}
    """
    await validate_api_key(x_api_key)
    run_id = await validate_run_id(body.run_id, db)

    dist_record = RunDistribution(
        run_id=run_id,
        step=body.step,
        distributions=body.distributions,
    )

    db.add(dist_record)
    await db.commit()

    return SuccessResponse(message=f"Logged distributions for run {run_id} at step {body.step}")


@router.post("/finalize", response_model=SuccessResponse)
async def finalize_run(
    body: FinalizeRequest,
    db: DbSession,
    x_api_key: str | None = Header(None),
):
    """
    Finalize a training run with summary data.

    Compatible with PrimeMonitor.save_final_summary() method.
    Expects: {"run_id": "123", "summary": {...}}
    """
    await validate_api_key(x_api_key)
    run_id = await validate_run_id(body.run_id, db)

    # Check if summary already exists
    result = await db.execute(select(RunSummary).where(RunSummary.run_id == run_id))
    existing = result.scalar_one_or_none()

    if existing:
        # Update existing summary
        existing.summary = body.summary
        existing.status = RunFinalizedStatus.FINALIZED
        existing.finalized_at = datetime.now(timezone.utc)
    else:
        # Create new summary
        summary_record = RunSummary(
            run_id=run_id,
            summary=body.summary,
            status=RunFinalizedStatus.FINALIZED,
            finalized_at=datetime.now(timezone.utc),
        )
        db.add(summary_record)

    await db.commit()

    return SuccessResponse(message=f"Finalized run {run_id}")


# ============================================================================
# Query Endpoints (For Frontend Charts)
# ============================================================================


@router.get("/runs/{run_id}/metrics", response_model=MetricsResponse)
async def get_run_metrics(
    run_id: int,
    db: DbSession,
    limit: int = Query(1000, ge=1, le=10000),
    offset: int = Query(0, ge=0),
):
    """
    Get all metrics for a run.

    Returns raw metrics data in chronological order.
    """
    # Verify run exists
    result = await db.execute(select(Run).where(Run.id == run_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")

    result = await db.execute(
        select(RunMetrics)
        .where(RunMetrics.run_id == run_id)
        .order_by(RunMetrics.created_at.asc())
        .offset(offset)
        .limit(limit)
    )
    records = result.scalars().all()

    data = []
    for record in records:
        entry = {
            "id": record.id,
            "step": record.step,
            "metrics": record.metrics,
            "created_at": record.created_at.isoformat(),
        }
        data.append(entry)

    return MetricsResponse(run_id=run_id, data=data)


@router.get("/runs/{run_id}/metrics/available", response_model=AvailableMetricsResponse)
async def get_available_metrics(run_id: int, db: DbSession):
    """
    Get list of available metric names for a run.

    Scans through metrics to find all unique metric keys.
    """
    # Verify run exists
    result = await db.execute(select(Run).where(Run.id == run_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")

    result = await db.execute(
        select(RunMetrics.metrics).where(RunMetrics.run_id == run_id).limit(100)
    )
    records = result.scalars().all()

    # Collect all unique metric names
    metric_names: set[str] = set()
    for metrics_dict in records:
        if isinstance(metrics_dict, dict):
            metric_names.update(metrics_dict.keys())

    return AvailableMetricsResponse(run_id=run_id, metrics=sorted(metric_names))


@router.get("/runs/{run_id}/metrics/{metric_name:path}", response_model=MetricSeriesResponse)
async def get_metric_series(
    run_id: int,
    metric_name: str,
    db: DbSession,
    limit: int = Query(1000, ge=1, le=10000),
):
    """
    Get time series data for a specific metric.

    Returns step/value pairs for charting.
    The metric_name uses path syntax to support nested names like "reward/mean".
    """
    # Verify run exists
    result = await db.execute(select(Run).where(Run.id == run_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")

    result = await db.execute(
        select(RunMetrics)
        .where(RunMetrics.run_id == run_id)
        .order_by(RunMetrics.created_at.asc())
        .limit(limit)
    )
    records = result.scalars().all()

    data = []
    for record in records:
        if isinstance(record.metrics, dict) and metric_name in record.metrics:
            value = record.metrics[metric_name]
            if isinstance(value, (int, float)):
                data.append(
                    MetricSeriesPoint(
                        step=record.step,
                        value=float(value),
                        timestamp=record.created_at,
                    )
                )

    return MetricSeriesResponse(run_id=run_id, metric_name=metric_name, data=data)


@router.get("/runs/{run_id}/samples", response_model=SamplesListResponse)
async def get_run_samples(
    run_id: int,
    db: DbSession,
    step: int | None = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """
    Get sample/rollout data for a run.

    Optionally filter by step.
    """
    # Verify run exists
    result = await db.execute(select(Run).where(Run.id == run_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")

    # Build query
    query = select(RunSample).where(RunSample.run_id == run_id)
    count_query = select(func.count(RunSample.id)).where(RunSample.run_id == run_id)

    if step is not None:
        query = query.where(RunSample.step == step)
        count_query = count_query.where(RunSample.step == step)

    # Get total count
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    # Get samples
    result = await db.execute(
        query.order_by(RunSample.created_at.desc()).offset(offset).limit(limit)
    )
    records = result.scalars().all()

    samples = [
        SampleResponse(
            id=r.id,
            step=r.step,
            example_id=r.example_id,
            prompt=r.prompt,
            completion=r.completion,
            trajectory=r.trajectory,
            reward=r.reward,
            advantage=r.advantage,
            answer=r.answer,
            task=r.task,
            info=r.info,
            metrics=r.sample_metrics,
            timing=r.timing,
            created_at=r.created_at,
        )
        for r in records
    ]

    return SamplesListResponse(run_id=run_id, total=total, samples=samples)


@router.get("/runs/{run_id}/distributions", response_model=DistributionsListResponse)
async def get_run_distributions(
    run_id: int,
    db: DbSession,
    limit: int = Query(100, ge=1, le=1000),
):
    """
    Get distribution data for a run.

    Returns reward/advantage distributions at each logged step.
    """
    # Verify run exists
    result = await db.execute(select(Run).where(Run.id == run_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")

    result = await db.execute(
        select(RunDistribution)
        .where(RunDistribution.run_id == run_id)
        .order_by(RunDistribution.step.asc())
        .limit(limit)
    )
    records = result.scalars().all()

    data = [
        DistributionResponse(
            step=r.step,
            distributions=r.distributions,
            created_at=r.created_at,
        )
        for r in records
    ]

    return DistributionsListResponse(run_id=run_id, data=data)


@router.get("/runs/{run_id}/summary")
async def get_run_summary(run_id: int, db: DbSession):
    """
    Get the final summary for a run.
    """
    # Verify run exists
    result = await db.execute(select(Run).where(Run.id == run_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")

    result = await db.execute(select(RunSummary).where(RunSummary.run_id == run_id))
    summary = result.scalar_one_or_none()

    if not summary:
        return {"run_id": run_id, "summary": None, "status": "active"}

    return {
        "run_id": run_id,
        "summary": summary.summary,
        "status": summary.status,
        "created_at": summary.created_at.isoformat(),
        "finalized_at": summary.finalized_at.isoformat() if summary.finalized_at else None,
    }
