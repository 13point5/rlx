"""Job template definitions for runs."""

from database import Job, JobStatus, JobType


# Job template definitions - reused in create_run and sync_jobs
# Each template has a sequence, job_type, and get_config function that takes a context dict
JOB_TEMPLATES = [
    {
        "sequence": 0,
        "job_type": JobType.CUSTOM_COMMAND,
        "get_config": lambda ctx: {
            "command": f"""#!/bin/bash
set -e

echo "=== Cloning user repository ==="
git clone --depth 1 --branch {ctx['branch']} {ctx['repo_url']} /workspace/repo
echo "User repo cloned successfully"

echo "=== Listing repository files ==="
ls -la /workspace/repo

echo "=== Cloning prime-rl framework ==="
git clone --depth 1 --branch main https://github.com/PrimeIntellect-ai/prime-rl.git /workspace/prime-rl
echo "Prime-rl cloned successfully"

echo "=== Installing uv package manager ==="
cd /workspace/prime-rl
(curl -LsSf https://astral.sh/uv/install.sh | sh || true) && echo 'source $HOME/.local/bin/env' >> ~/.bashrc
source $HOME/.local/bin/env

echo "=== Installing prime-rl dependencies ==="
uv sync --all-extras

echo "=== Installing user's verifier environment ==="
uv pip install -e /workspace/repo

echo "=== Verifying installation ==="
uv run python -c "import prime_rl; print('prime_rl imported successfully')"

echo "=== Reading rlx.toml configuration ==="
cat /workspace/repo/rlx.toml

echo "=== Setup completed successfully ==="
""",
            "working_dir": "/workspace",
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
