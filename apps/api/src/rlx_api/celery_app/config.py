"""Celery configuration settings."""

import os

from pydantic_settings import BaseSettings


class CelerySettings(BaseSettings):
    """Celery configuration settings loaded from environment."""

    # Redis connection
    redis_url: str = "redis://localhost:6379/0"

    # Task settings
    task_timeout: int = 3600  # 1 hour default
    clone_timeout: int = 600  # 10 minutes for clone
    command_timeout: int = 300  # 5 minutes for general commands

    # Retry settings
    max_retries: int = 3
    retry_delay: int = 60

    # Worker settings
    worker_concurrency: int = 4

    # Job check interval (seconds)
    job_check_interval: float = 30.0

    class Config:
        env_prefix = "CELERY_"


settings = CelerySettings()
