"""Job template definitions for runs."""

from database import Job, JobStatus, JobType


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
        "get_config": lambda ctx: {
            "command": "source $HOME/.local/bin/env && uv pip install -e /workspace/repo",
            "working_dir": "/workspace/prime-rl",
            "timeout_seconds": None,
        },
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
        "job_type": JobType.START_PRIME_RL,
        "get_config": lambda ctx: _get_prime_rl_config(ctx),
    },
]


def _get_prime_rl_config(ctx: dict) -> dict:
    """
    Build prime-RL job config based on the config_name.

    If config_name ends with '.toml', use single file mode.
    Otherwise, treat it as a directory containing train.toml, orch.toml, infer.toml.

    Config paths are relative to the user's repo at /workspace/repo.
    """
    config_name = ctx.get("config_name", "")
    repo_path = "/workspace/repo"

    if config_name.endswith(".toml"):
        # Single file mode
        return {
            "config_path": f"{repo_path}/{config_name}",
            "working_dir": "/workspace/prime-rl",
            "timeout_seconds": None,  # No timeout for long-running training
        }
    else:
        # Three file mode - config_name is a directory
        config_dir = config_name.rstrip("/")
        return {
            "trainer_config": f"{repo_path}/{config_dir}/train.toml",
            "orchestrator_config": f"{repo_path}/{config_dir}/orch.toml",
            "inference_config": f"{repo_path}/{config_dir}/infer.toml",
            "working_dir": "/workspace/prime-rl",
            "timeout_seconds": None,  # No timeout for long-running training
        }


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
