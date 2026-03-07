"""Job template definitions for runs."""

import posixpath
import shlex
from typing import Any

from rlx_api.database import Job, JobStatus, JobType


def _resolve_repo_relative_path(config_path: str) -> str:
    """Resolve a repo-relative config path to the pod's cloned repo path."""
    normalized = config_path.strip()
    if not normalized:
        raise ValueError("config_path is required for the Prime RL launch job")
    if normalized.startswith("/"):
        raise ValueError("config_path must be relative to the repository root")

    pod_path = posixpath.normpath(posixpath.join("/workspace/repo", normalized))
    if not pod_path.startswith("/workspace/repo/"):
        raise ValueError("config_path must resolve inside /workspace/repo")

    return pod_path


def _build_prime_rl_launch_config(ctx: dict[str, Any]) -> dict[str, Any]:
    """Build the final launch command for Prime RL."""
    config_path = ctx.get("config_path")
    if not isinstance(config_path, str):
        raise ValueError("config_path is required in the job template context")

    pod_config_path = _resolve_repo_relative_path(config_path)
    job_config: dict[str, Any] = {
        "command": (
            "source $HOME/.local/bin/env && "
            f"uv run rl @ {shlex.quote(pod_config_path)}"
        ),
        "working_dir": "/workspace/prime-rl",
        "timeout_seconds": None,
        "inject_wandb_api_key": True,
    }

    env_vars = ctx.get("env_vars")
    if isinstance(env_vars, dict) and env_vars:
        job_config["env"] = env_vars

    return job_config


def _build_repo_install_config(ctx: dict[str, Any]) -> dict[str, Any]:
    """Build the editable install command for the repo or nested env package."""
    env_path = ctx.get("env_path")
    install_target = "/workspace/repo"
    if isinstance(env_path, str) and env_path:
        install_target = _resolve_repo_relative_path(env_path)

    return {
        "command": f"source $HOME/.local/bin/env && uv pip install -e {shlex.quote(install_target)}",
        "working_dir": "/workspace/prime-rl",
        "timeout_seconds": None,
    }


# Job template definitions - reused in create_run and sync_jobs
# Each template has a sequence, job_type, and get_config function that takes a context dict
JOB_TEMPLATES = [
    {
        "sequence": 0,
        "job_type": JobType.CLONE_REPO,
        "get_config": lambda ctx: {
            "repo_url": ctx["repo_url"],
            "branch": ctx["branch"],
            "target_dir": "/workspace/repo",
            "depth": 1,
        },
    },
    {
        "sequence": 1,
        "job_type": JobType.LIST_FILES,
        "get_config": lambda ctx: {"target_dir": "/workspace/repo"},
    },
    {
        "sequence": 2,
        "job_type": JobType.CLONE_REPO,
        "get_config": lambda ctx: {
            "repo_url": "https://github.com/PrimeIntellect-ai/prime-rl.git",
            "branch": "main",
            "target_dir": "/workspace/prime-rl",
            "depth": 1,
        },
    },
    {
        "sequence": 3,
        "job_type": JobType.CUSTOM_COMMAND,
        "get_config": lambda ctx: {
            "command": "(curl -LsSf https://astral.sh/uv/install.sh | sh || true) && echo 'source $HOME/.local/bin/env' >> ~/.bashrc",
            "working_dir": "/workspace/prime-rl",
            "timeout_seconds": None,
        },
    },
    {
        "sequence": 4,
        "job_type": JobType.CUSTOM_COMMAND,
        "get_config": lambda ctx: {
            "command": "source $HOME/.local/bin/env && uv sync --all-extras",
            "working_dir": "/workspace/prime-rl",
            "timeout_seconds": None,
        },
    },
    {
        "sequence": 5,
        "job_type": JobType.CUSTOM_COMMAND,
        "get_config": _build_repo_install_config,
    },
    {
        "sequence": 6,
        "job_type": JobType.CUSTOM_COMMAND,
        "get_config": lambda ctx: {
            "command": "source $HOME/.local/bin/env && uv run python -c \"import prime_rl; print('prime_rl imported successfully')\"",
            "working_dir": "/workspace/prime-rl",
            "timeout_seconds": 60,
        },
    },
    {
        "sequence": 7,
        "job_type": JobType.CUSTOM_COMMAND,
        "get_config": lambda ctx: {
            "command": "cat /workspace/repo/rlx.toml",
            "working_dir": "/workspace/repo",
            "timeout_seconds": 30,
        },
    },
    {
        "sequence": 8,
        "job_type": JobType.CUSTOM_COMMAND,
        "get_config": _build_prime_rl_launch_config,
    },
]


def create_jobs_from_templates(
    run_id: int,
    clerk_user_id: str,
    ctx: dict,
    existing_sequences: set[int] | None = None,
) -> list[Job]:
    """Create Job objects from templates, optionally skipping existing sequences."""
    jobs = []
    for template in JOB_TEMPLATES:
        if existing_sequences and template["sequence"] in existing_sequences:
            continue
        jobs.append(
            Job(
                run_id=run_id,
                clerk_user_id=clerk_user_id,
                job_type=template["job_type"],
                job_config=template["get_config"](ctx),
                status=JobStatus.PENDING,
                sequence=template["sequence"],
            )
        )
    return jobs
