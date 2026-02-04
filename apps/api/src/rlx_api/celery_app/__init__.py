"""Celery application configuration."""

import os

from celery import Celery
from dotenv import load_dotenv

from .config import settings

load_dotenv()


def make_celery() -> Celery:
    """Create and configure the Celery application."""

    redis_url = os.getenv("REDIS_URL", settings.redis_url)

    app = Celery(
        "rlx",
        broker=redis_url,
        backend=redis_url,
        include=[
            "rlx_api.celery_app.tasks.pod_tasks",
            "rlx_api.celery_app.tasks.repo_tasks",
        ],
    )

    # Celery configuration
    app.conf.update(
        # Serialization
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",
        # Timezone
        timezone="UTC",
        enable_utc=True,
        # Task execution
        task_acks_late=True,  # Acknowledge after task completes
        task_reject_on_worker_lost=True,  # Re-queue if worker dies
        worker_prefetch_multiplier=1,  # Fetch one task at a time (for long tasks)
        # Results
        result_expires=86400,  # Results expire after 24 hours
        result_extended=True,  # Store additional metadata
        # Broker settings (Redis-specific)
        broker_connection_retry_on_startup=True,
        broker_transport_options={
            "visibility_timeout": 3600,  # 1 hour (for long-running tasks)
            "fanout_prefix": True,
            "fanout_patterns": True,
        },
        # Retry policy
        task_default_retry_delay=settings.retry_delay,
        task_max_retries=settings.max_retries,
        # Task routing
        task_routes={
            "celery_app.tasks.pod_tasks.*": {"queue": "pod_ops"},
            "celery_app.tasks.repo_tasks.*": {"queue": "repo_ops"},
        },
        # Beat schedule (periodic tasks)
        beat_schedule={
            "check-pending-jobs": {
                "task": "celery_app.tasks.pod_tasks.check_pending_jobs",
                "schedule": settings.job_check_interval,
            },
            "check-pending-run-statuses": {
                "task": "celery_app.tasks.pod_tasks.check_pending_run_statuses",
                "schedule": 15.0,  # Check every 15 seconds for pods becoming ready
            },
        },
    )

    return app


celery_app = make_celery()
