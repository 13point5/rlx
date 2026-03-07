# Run Flow: Creation, Activation, Jobs, and Display

This document describes the current run lifecycle in RLX.

For the broader system map, see `docs/architecture_walkthrough.md`.

## Overview

A run in RLX is:

- a Prime Intellect pod provisioned for a selected project
- plus the metadata needed to identify the branch and selected `rlx.toml` config name
- plus a sequence of Celery-managed jobs executed on that pod over SSH

The important current detail is that the selected `rlx.toml` entry is resolved to a concrete config file path before the launch job is created. The final launch command uses Prime RL's config-file syntax:

```bash
uv run rl @ /workspace/repo/path/to/config.toml
```

## Run Record

The `Run` model stores:

- `project_id`
- `clerk_user_id`
- `name`
- `branch`
- `config_name`
- provisioned instance metadata:
  - `provider`
  - `region`
  - `data_center`
  - `country`
  - `gpu_type`
  - `gpu_count`
  - `security`
  - `cloud_id`
  - `pod_id`
  - `is_spot`
- `status`
- `ssh_connection` once the pod becomes active

The resolved config file path is used for job creation and launch, not for the main run display.

## 1. Run Creation Flow

### Frontend

The new-run page:

1. loads project metadata
2. loads branches from GitHub
3. loads all Prime Intellect GPU availability
4. loads `rlx.toml` from the selected branch
5. lets the user pick a config entry by name

When the user clicks `Start Run`, the frontend sends:

- `project_id`
- `name`
- `branch`
- `config_name`
- selected instance metadata

### Backend

`POST /api/runs` does the following:

1. validates project ownership
2. validates the user has a configured SSH key
3. strips the `origin/` prefix from the branch for Git operations
4. resolves the selected `config_name` against `rlx.toml` in the selected branch
5. requires that the selected entry expose a single `config` file path
6. validates that the referenced config file actually exists on that branch
7. provisions the Prime Intellect pod
8. inserts the `Run`
9. inserts the default `Job` sequence for that run

### Why `config_name` and `config` both matter

- `config_name` is the stable user-facing selection
- `config` is the concrete file path Prime RL actually launches with

Example from `/Users/13point5/projects/swe-grep-oss/rlx.toml`:

```toml
[grpo-f1]
description = "GRPO reinforcement learning with just the F1 reward"
config = "configs/grpo-f1.toml"
```

This means the launch job will ultimately target:

```bash
uv run rl @ /workspace/repo/configs/grpo-f1.toml
```

## 2. Default Job Sequence

When a run is created, RLX seeds these jobs:

| Sequence | Type | Purpose |
| --- | --- | --- |
| 0 | `CLONE_REPO` | Clone the user repo to `/workspace/repo` |
| 1 | `LIST_FILES` | List files in `/workspace/repo` |
| 2 | `CLONE_REPO` | Clone `PrimeIntellect-ai/prime-rl` to `/workspace/prime-rl` |
| 3 | `CUSTOM_COMMAND` | Install `uv` |
| 4 | `CUSTOM_COMMAND` | Run `uv sync --all-extras` inside `prime-rl` |
| 5 | `CUSTOM_COMMAND` | Run `uv pip install -e /workspace/repo` |
| 6 | `CUSTOM_COMMAND` | Verify `import prime_rl` |
| 7 | `CUSTOM_COMMAND` | Print `/workspace/repo/rlx.toml` |
| 8 | `CUSTOM_COMMAND` | Launch Prime RL with the resolved config path |

The final launch job uses the config path from the selected `rlx.toml` entry.

## 3. Pod Activation Flow

Run activation is handled by Celery Beat, not by frontend polling.

### Background status loop

`check_pending_run_statuses` runs periodically and:

1. finds runs in `PENDING` or `PROVISIONING`
2. calls Prime Intellect for their current pod status
3. updates `Run.status`
4. stores `Run.ssh_connection` when the pod becomes `ACTIVE`
5. triggers `on_pod_ready`

### Why this matters

The run detail page can be closed. Jobs still start because activation is worker-driven.

## 4. Job Execution Flow

Once a run is `ACTIVE`:

1. `on_pod_ready` queues the first pending job
2. the worker executes that job over SSH
3. on success, `start_next_job_for_run()` queues the next one
4. on failure, the sequence stops
5. the user can retry the failed job

Each executed command is recorded in `JobCommand` with:

- stdout
- stderr
- exit code
- duration

That is what powers the run page's job log UI.

Important current limitation:

- for long-running commands, RLX persists `stdout` / `stderr` only after the SSH command returns
- the jobs panel polls status while a job is active, but it does not stream partial command output yet

## 5. Status Display Flow

### Run page

The run page:

1. fetches the run record server-side
2. renders the status panel with the last known status
3. polls `GET /api/runs/{run_id}/status` from the client

Important detail:

- that endpoint reads from the database only
- it does not call Prime Intellect directly

### Jobs panel

The jobs panel:

1. polls `GET /api/jobs?run_id=...` while jobs are active
2. sorts jobs by `sequence`
3. expands into `GET /api/jobs/{job_id}` for detailed command logs
4. allows retrying failed jobs
5. allows syncing missing template jobs into older runs

## 6. Config-Path Launch Contract

RLX currently expects the selected `rlx.toml` entry to provide a single `config` field.

That supports example repos like `/Users/13point5/projects/swe-grep-oss`, where:

- `rlx.toml` maps a friendly name like `grpo-f1`
- to a concrete file like `configs/grpo-f1.toml`

The launch job resolves that path onto the pod as:

```text
/workspace/repo/configs/grpo-f1.toml
```

and runs:

```bash
source $HOME/.local/bin/env && uv run rl @ /workspace/repo/configs/grpo-f1.toml
```

## 7. Current Limits

The current launcher is intentionally narrow:

- it uses a single `config` file path
- it does not yet launch from split `trainer` / `orchestrator` / `inference` config triplets
- it does forward `env_vars` from the selected `rlx.toml` entry into the final launch job
- it does not yet inject stored W&B secrets into the environment automatically

That keeps the first Prime RL launch path aligned with the example repo and the existing UI.
