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
