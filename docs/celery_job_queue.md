# Celery Job Queue System

This document describes the current Celery + Redis job system in RLX.

For the broader application walkthrough, see `docs/architecture_walkthrough.md`.

## Overview

RLX uses Celery to execute pod work asynchronously after a run is created.

The queue system is responsible for:

- waiting for Prime Intellect pods to become ready
- starting jobs in sequence
- SSHing into the pod
- cloning repositories
- bootstrapping `prime-rl`
- launching Prime RL with the selected config file path
- recording command output for the UI

## Runtime Components

```text
FastAPI -> PostgreSQL
       -> Redis
          -> Celery worker
          -> Celery beat
       -> Prime Intellect API
       -> AWS Secrets Manager

Celery worker -> SSH -> Prime Intellect pod
```

## Core Pieces

### Celery app

`apps/api/src/rlx_api/celery_app/__init__.py` configures:

- Redis broker/backend
- queue routing
- retry defaults
- periodic tasks

### Task base

`apps/api/src/rlx_api/celery_app/tasks/base.py` provides:

- sync DB sessions for worker processes
- job status update helpers
- command logging helpers

### SSH executor

`apps/api/src/rlx_api/celery_app/executors/ssh.py`:

- parses Prime Intellect SSH connection strings
- opens SSH sessions with the user's stored private key
- executes commands with timeout and env support
- exposes a streaming helper, but the current queue path still uses the non-streaming execution method

### Pod tasks

`apps/api/src/rlx_api/celery_app/tasks/pod_tasks.py` owns:

- run readiness polling
- first-job kickoff
- next-job sequencing
- fallback queue repair for stuck runs

### Repo tasks

`apps/api/src/rlx_api/celery_app/tasks/repo_tasks.py` owns:

- `clone_repository`
- `list_files`
- `run_custom_command`

## Job State Model

Each `Job` moves through:

1. `PENDING`
2. `QUEUED`
3. `RUNNING`
4. `SUCCESS` or `FAILED` / `TIMEOUT` / `CANCELLED`

Important sequencing rule:

- the next job starts only when the current one succeeds
- failures block later jobs until retried

## How Run Activation Works

Runs do not depend on the frontend staying open.

`check_pending_run_statuses` runs periodically and:

1. finds runs in `PENDING` or `PROVISIONING`
2. fetches pod status from Prime Intellect
3. updates the run record in PostgreSQL
4. stores `ssh_connection` once the pod is active
5. triggers `on_pod_ready`

Once the run is active:

1. `on_pod_ready` finds the first pending job
2. `queue_job()` atomically claims it
3. the worker runs it
4. `start_next_job_for_run()` advances the sequence on success

## Default Job Sequence

Jobs are seeded from `apps/api/src/rlx_api/job_templates.py`.

Current default sequence:

| Sequence | Type | Purpose |
| --- | --- | --- |
| 0 | `CLONE_REPO` | Clone user repo to `/workspace/repo` |
| 1 | `LIST_FILES` | List files in `/workspace/repo` |
| 2 | `CLONE_REPO` | Clone `PrimeIntellect-ai/prime-rl` to `/workspace/prime-rl` |
| 3 | `CUSTOM_COMMAND` | Install `uv` |
| 4 | `CUSTOM_COMMAND` | Run `uv sync --all-extras` in `prime-rl` |
| 5 | `CUSTOM_COMMAND` | Run `uv pip install -e /workspace/repo` |
| 6 | `CUSTOM_COMMAND` | Verify `import prime_rl` |
| 7 | `CUSTOM_COMMAND` | Print `/workspace/repo/rlx.toml` |
| 8 | `CUSTOM_COMMAND` | Launch Prime RL with the resolved config path |

## How The Launch Job Gets Its Config Path

The run request still sends a user-facing `config_name`, but the launch job needs a concrete file path.

RLX resolves that by:

1. fetching `rlx.toml` from the selected repo branch
2. finding the selected config entry by name
3. requiring that entry to expose `config = "path/to/file.toml"`
4. validating that the referenced config file exists on that branch
5. building the launch job with that path
6. attaching `env_vars` from the same `rlx.toml` entry if present

Example:

```toml
[grpo-f1]
description = "GRPO reinforcement learning with just the F1 reward"
config = "configs/grpo-f1.toml"
```

This becomes the pod-side command:

```bash
source $HOME/.local/bin/env && uv run rl @ /workspace/repo/configs/grpo-f1.toml
```

## Why The Queue Uses Job Config Instead Of Re-Parsing On The Pod

The queue system builds a concrete launch job before execution so that:

- the worker has a deterministic command to run
- job logs clearly show the exact launch command
- the launch step fits the same retry and sequencing model as the setup steps

## Syncing Old Runs

`POST /api/runs/{run_id}/sync-jobs` compares existing job sequences with the current template and adds any missing jobs.

That is useful when new job steps are added after a run already exists.

For config-path-based launch jobs, sync logic re-resolves the selected `config_name` from `rlx.toml`.

## Command Logging

Each executed command is stored in `JobCommand` with:

- command text
- working directory
- stdout
- stderr
- exit code
- duration

This is what the run page displays when you expand a job.

Important current limitation:

- `stdout` and `stderr` are written after command completion
- the UI polls job state, but it does not receive live partial output for a still-running command

## Local Development

Start the API:

```bash
cd apps/api
uv run uvicorn rlx_api.main:app --reload --port 8000
```

Start the worker:

```bash
cd apps/api
uv run celery -A rlx_api.celery_app:celery_app worker --loglevel=info -Q pod_ops,repo_ops
```

Start beat:

```bash
cd apps/api
uv run celery -A rlx_api.celery_app:celery_app beat --loglevel=info
```

Or use the repo-level helpers:

- `docker-compose.yml`
- `dev.sh`
