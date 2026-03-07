# RLX Architecture and Flow Walkthrough

This walkthrough is based on the current code in the repo. The supporting docs in `docs/` have been refreshed to match the same behavior.

The short version: RLX provisions Prime Intellect pods, clones the user repo, clones `prime-rl`, bootstraps the environment, resolves the selected `rlx.toml` entry to a concrete config path, and launches Prime RL as a queued job while recording all command output.

## 1. What The App Does Today

RLX is a monorepo with:

- A Next.js web app in `apps/web`
- A FastAPI backend in `apps/api`
- PostgreSQL for persisted app state
- Redis + Celery for asynchronous job execution

The current user journey is:

1. Sign in with Clerk
2. Connect GitHub
3. Import a GitHub repo as a project
4. Choose a branch and an `rlx.toml` config name
5. Pick a GPU instance from Prime Intellect availability
6. Start a run, which provisions a pod
7. Wait for the pod to become active
8. Let Celery execute setup jobs on the pod over SSH

What happens after setup:

- The pod gets prepared for `prime-rl`
- The selected run metadata is stored
- Job output is visible in the UI
- A final job launches Prime RL from the resolved config file path

## 2. Runtime Topology

The deployed/local runtime is effectively:

```text
Browser
  -> Next.js app (`apps/web`)
     -> Server Actions (`apps/web/app/actions/api.ts`)
        -> FastAPI (`apps/api/src/rlx_api/main.py`)
           -> PostgreSQL
           -> Prime Intellect API
           -> GitHub API
           -> AWS Secrets Manager
           -> Redis
              -> Celery worker
              -> Celery beat
                 -> SSH into Prime Intellect pod
```

Local orchestration:

- `docker-compose.yml` starts `web`, `api`, `redis`, `worker`, and `scheduler`
- `dev.sh` starts the same stack in tmux for local development

## 3. Repo Map

### Backend

- `apps/api/src/rlx_api/main.py`: FastAPI app entrypoint and router registration
- `apps/api/src/rlx_api/deps.py`: auth and DB dependencies
- `apps/api/src/rlx_api/database.py`: SQLAlchemy models and status enums
- `apps/api/src/rlx_api/routers/`: HTTP endpoints
- `apps/api/src/rlx_api/services/`: GitHub, Prime Intellect, and AWS wrappers
- `apps/api/src/rlx_api/job_templates.py`: default run job pipeline
- `apps/api/src/rlx_api/celery_app/`: Celery app, task base, executors, and tasks

### Frontend

- `apps/web/app/`: App Router pages
- `apps/web/app/actions/api.ts`: server action boundary to the backend
- `apps/web/components/`: feature components
- `apps/web/lib/types.ts`: shared frontend API types
- `apps/web/lib/gpu-utils.ts`: client-side availability summarization

### Docs / Utilities

- `docs/`: project docs, some current and some historical
- `scripts/`: helper shell scripts
- `docker-compose.yml`, `dev.sh`: local environment entrypoints

## 4. Backend Architecture

### 4.1 FastAPI app

`main.py` wires up:

- CORS, driven by `CORS_ORIGINS`
- Routers:
  - `health`
  - `compute`
  - `github`
  - `projects`
  - `runs`
  - `ssh_keys`
  - `jobs`
  - `wandb`

### 4.2 Auth model

Auth is Clerk end to end:

- The web app gets a Clerk session token in server actions
- The backend validates it in `deps.py`
- The backend also checks the token's authorized party against `CORS_ORIGINS`

Important implication:

- Every backend route that matters is user-scoped with `clerk_user_id`

### 4.3 Data model

The main models live in `database.py`.

### `GitHubConnection`

Stores one GitHub OAuth connection per Clerk user:

- GitHub user info
- access token
- refresh token
- token expiry

### `Project`

Represents an imported GitHub repo:

- `clerk_user_id`
- `repo_id`
- `repo_name`
- `repo_owner`
- `repo_owner_type`
- `repo_url`

This is the anchor for run creation.

### `Run`

Represents a provisioned Prime Intellect pod plus RLX metadata:

- `project_id`
- `clerk_user_id`
- `name`
- `branch`
- `config_name`
- pod/provisioning metadata:
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

Important current limitation:

- The run stores only `config_name`, not the resolved config payload from `rlx.toml`

### `UserSshKey`

Stores per-user SSH access configuration:

- public key
- Prime Intellect SSH key id
- AWS Secrets Manager ARN for the private key
- optional name

This is required before a run can be created.

### `Job`

Represents a queued/executed step for a run:

- `run_id`
- `job_type`
- `job_config` JSON
- `status`
- `sequence`
- `celery_task_id`
- timestamps and error fields

Jobs are strictly sequence-ordered per run.

### `JobCommand`

Stores the concrete command executions for each job:

- command text
- working directory
- stdout
- stderr
- exit code
- status
- duration

This is what powers the command log view in the run page.

### 4.4 Service layer

### Prime Intellect service

`services/prime_intellect.py` is a thin API wrapper around:

- GPU availability
- pod creation
- pod status polling
- pod deletion
- SSH key upload/list/delete/set-primary

It normalizes inconsistent pod response keys with `normalize_pod_response()`.

### GitHub service

`services/github.py` handles:

- OAuth token exchange and refresh
- repo listing
- repo access verification
- branch listing
- parsing `rlx.toml`

`fetch_rlx_config()` reads `rlx.toml` from the selected branch using the GitHub contents API and returns:

- `name`
- `description`
- `config`
- `inference`
- `orchestrator`
- `trainer`
- `env_vars`

Important current limitation:

- The richer config payload is used for launch-job construction, not for the main run record
- It is not persisted on `Run`
- Only the single-file `config` field is used by the current launcher
- `env_vars` from the selected entry are forwarded into the final launch job if present

### AWS Secrets Manager service

`services/aws_secrets_manager.py` stores:

- SSH private keys
- W&B API keys

Current usage:

- SSH private keys are used by the Celery worker to SSH into pods
- W&B API keys are stored, but not yet wired into run/job execution

## 5. Queueing And Execution Architecture

Celery lives under `apps/api/src/rlx_api/celery_app`.

### `celery_app/__init__.py`

Configures:

- Redis as broker and result backend
- queues:
  - `pod_ops`
  - `repo_ops`
- beat schedules:
  - `check_pending_jobs`
  - `check_pending_run_statuses`

### `tasks/base.py`

Provides:

- a sync SQLAlchemy session for worker processes
- helper methods to update job state
- helper methods to record command execution

### `executors/ssh.py`

Implements `SSHCommandExecutor` using `asyncssh`.

It parses Prime Intellect connection strings like:

- `ssh ubuntu@1.2.3.4 -p 22`
- `ubuntu@1.2.3.4`

and runs commands with:

- optional working directory
- optional env vars
- optional timeout

### `tasks/pod_tasks.py`

Owns sequencing and run readiness:

- `check_pending_run_statuses`
  - polls Prime Intellect for `PENDING` / `PROVISIONING` runs
  - updates `Run.status`
  - stores `Run.ssh_connection`
  - triggers `on_pod_ready` when a run becomes `ACTIVE`
- `on_pod_ready`
  - starts the first pending job for the run
- `start_next_job_for_run`
  - starts the next pending job after a successful previous job
- `queue_job`
  - atomically claims a job and dispatches the correct Celery task

Important behavior:

- Jobs only advance on success
- Failed jobs block later jobs until retried
- The system no longer depends on frontend polling to start jobs

### `tasks/repo_tasks.py`

Owns actual pod work:

- `clone_repository`
- `list_files`
- `run_custom_command`

Each task:

1. Marks the job `RUNNING`
2. Builds or reads the command from `job_config`
3. Creates an `SSHCommandExecutor`
4. Records a `JobCommand`
5. Executes on the pod
6. Updates `JobCommand` with stdout/stderr/exit code
7. Marks the `Job` `SUCCESS` or `FAILED`
8. Starts the next job if successful

Important current limitation:

- the task path uses non-streaming SSH execution
- command output is persisted after the command exits, so the UI does not show live partial logs for a running long-lived process

## 6. Frontend Architecture

### 6.1 App shell and route protection

The web app uses Next.js App Router.

Important pieces:

- `app/layout.tsx`
  - wraps the app in `ClerkProvider`
  - wraps client state with React Query `Providers`
- `proxy.ts`
  - protects everything except `/`, `/sign-in`, and `/sign-up`
- `app/(auth)/layout.tsx`
  - redirects unauthenticated users to sign-in

### 6.2 Server action boundary

`app/actions/api.ts` is the main frontend/backend integration layer.

Pattern:

1. Read Clerk auth on the server
2. Get a token with `getToken()`
3. Call the FastAPI backend with Axios
4. Return a typed `{ success, data/error }` object

This file is effectively the web app's internal API client.

### 6.3 Client state

React Query is used mainly for:

- run status polling
- job list polling
- job detail fetching
- settings data fetching

The app otherwise leans heavily on server-rendered pages plus client components for interactivity.

### 6.4 Breadcrumb architecture

The authenticated layout uses a parallel route for breadcrumbs:

- `app/(auth)/@breadcrumbs/[...path]/page.tsx`
- `lib/breadcrumb-utils.ts`
- `components/app-header.tsx`

That flow resolves project names dynamically so the header can show repo-aware breadcrumbs.

## 7. Main End-To-End Flows

### 7.1 GitHub connection and project import

### GitHub OAuth

1. The frontend calls `getGitHubAuthUrl()`
2. Backend `GET /api/github/authorize` builds a GitHub OAuth URL
3. Clerk user id is encoded into `state`
4. GitHub redirects back to `/api/github/callback`
5. The backend exchanges the code and upserts `GitHubConnection`

### Project creation

1. The user opens `/projects/new`
2. The client fetches accessible repos with `getGitHubRepos()`
3. The user picks a repo or pastes a repo URL
4. `createProject()` calls `POST /api/projects`
5. Backend:
   - parses the GitHub URL
   - verifies the user has a GitHub connection
   - verifies repo access via GitHub API
   - inserts a `Project`

### 7.2 New run page

`app/(auth)/projects/[id]/runs/new/page.tsx` loads three things in parallel through `getNewRunData()`:

- all Prime Intellect GPU availability
- the repo's branches
- the project metadata

### GPU handling

The frontend intentionally fetches all availability pages and summarizes them client-side:

- `getAllGpuAvailability()`
- `computeGpuSummary()`
- `GpuSelection`
- `GpuAvailability`

This means:

- the left side is a computed summary by GPU type and count
- the right side is the filtered instance list for the current selection

### Config handling

The selected branch drives `getProjectRlxConfig()`:

1. User changes branch
2. Frontend calls `GET /api/github/projects/{id}/rlx-config`
3. Backend fetches and parses `rlx.toml` from GitHub
4. The frontend shows available config names

Important current limitation:

- The UI sees full `RlxConfigEntry`
- But `startRun()` only sends `configName`

That is intentional in the current design:

- the backend re-resolves the selected name against the chosen branch
- validates the referenced config file exists
- builds the concrete launch job server-side

### 7.3 Run creation

The user clicks "Start Run" in `new-run-layout.tsx`.

### Frontend side

`startRun()` sends:

- `project_id`
- `name`
- `branch`
- `config_name`
- selected instance metadata

### Backend side

`POST /api/runs` in `routers/runs.py`:

1. Validates project ownership
2. Requires at least one configured `UserSshKey`
3. Builds the Prime Intellect pod payload
4. Calls `create_pod()`
5. Persists the `Run`
6. Creates initial `Job` rows from `job_templates.py`

The pod image is currently:

- `DEFAULT_IMAGE = "ubuntu_22_cuda_12"`

So RLX currently prepares `prime-rl` inside a generic CUDA Ubuntu pod rather than starting from a specialized image.

### 7.4 Pod activation and job execution

This is the most important flow for the next task.

### Pod readiness flow

1. Run starts in `PENDING` or `PROVISIONING`
2. Celery beat runs `check_pending_run_statuses`
3. It polls Prime Intellect for current pod status
4. When the pod becomes `ACTIVE`:
   - `Run.status` is updated
   - `Run.ssh_connection` is stored
   - `on_pod_ready` is dispatched

### Job sequencing flow

1. `on_pod_ready` queues the first pending job
2. The worker executes the job on the pod over SSH
3. On success, `start_next_job_for_run()` queues the next one
4. On failure, the sequence stops
5. The user can retry the failed job from the UI

### Current default job pipeline

From `job_templates.py`, a newly created run gets:

| Sequence | Type | Current purpose |
| --- | --- | --- |
| 0 | `CLONE_REPO` | Clone user repo to `/workspace/repo` |
| 1 | `LIST_FILES` | List files in `/workspace/repo` |
| 2 | `CLONE_REPO` | Clone `PrimeIntellect-ai/prime-rl` to `/workspace/prime-rl` |
| 3 | `CUSTOM_COMMAND` | Install `uv` |
| 4 | `CUSTOM_COMMAND` | Run `uv sync --all-extras` inside `prime-rl` |
| 5 | `CUSTOM_COMMAND` | Run `uv pip install -e /workspace/repo` |
| 6 | `CUSTOM_COMMAND` | Verify `import prime_rl` |
| 7 | `CUSTOM_COMMAND` | `cat /workspace/repo/rlx.toml` |
| 8 | `CUSTOM_COMMAND` | Launch `uv run rl @ /workspace/repo/...` from the selected `config` path |

Interpretation:

- Steps 0-7 are environment bootstrap plus verification
- Step 8 is the actual Prime RL launch step

What was verified live against `/Users/13point5/projects/swe-grep-oss`:

- RLX launched `uv run rl @ /workspace/repo/configs/grpo-f1.toml`
- the pod started trainer, orchestrator, and inference processes
- the local vLLM server became healthy on `localhost:8000`
- the orchestrator began validation and rollout generation on step `0`

### 7.5 Run detail page and monitoring

`app/(auth)/projects/[id]/runs/[runId]/page.tsx` renders:

- static run metadata
- `RunStatusPanel`
- `JobsPanel`

### Status panel

`RunStatusPanel`:

- polls `GET /api/runs/{runId}/status` every 5 seconds
- shows the current run status
- shows the SSH connection string once present
- lets the user terminate the run

Important detail:

- The status endpoint now reads from the database only
- It does not poll Prime Intellect directly anymore

### Jobs panel

`JobsPanel`:

- polls `GET /api/jobs?run_id=...` while jobs are active
- shows ordered jobs by `sequence`
- expands into command logs via `GET /api/jobs/{job_id}`
- allows retrying failed jobs
- allows syncing missing template jobs into old runs

This is the main UI you will use to debug the Prime RL launch job.

### 7.6 Settings flows

### SSH keys

The SSH key flow is important because it is part of pod access:

1. The user generates or uploads a key from the settings UI
2. The frontend can generate an Ed25519 pair in a server action
3. Backend stores:
   - public key in Prime Intellect
   - private key in AWS Secrets Manager
   - metadata in `UserSshKey`
4. New runs reference the Prime Intellect key id when provisioning pods
5. Workers later retrieve the private key from AWS to SSH into the pod

### W&B keys

The user can store a W&B API key in AWS Secrets Manager.

Current state:

- the settings UI is implemented
- the backend API is implemented
- but job execution does not yet fetch/inject that key into pod commands

## 8. Prime RL Launch State

The launch path now exists and is intentionally narrow.

### Implemented now

- Run creation resolves the selected `config_name` against `rlx.toml`
- The selected entry must expose a single `config = "path/to/file.toml"` value
- The final queued job launches Prime RL with:
  - `source $HOME/.local/bin/env && uv run rl @ /workspace/repo/...`
- `sync-jobs` re-resolves the selected config entry so older runs can pick up the launch step
- The Jobs panel shows the exact launch command, stdout, stderr, and exit code

### Current limits

- The launcher currently expects a single `config` file path
- Split `trainer` / `orchestrator` / `inference` config triplets are parsed, but not launched yet
- `env_vars` from `rlx.toml` can be attached to the launch job, but stored W&B API keys are still not injected automatically
- The `Run` record stores `config_name`; the concrete launch path lives in job config rather than the main run row

## 9. Files That Own This Behavior

- `apps/api/src/rlx_api/routers/runs.py`
- `apps/api/src/rlx_api/job_templates.py`
- `apps/api/src/rlx_api/services/github.py`
- `apps/web/app/(auth)/projects/[id]/runs/new/new-run-layout.tsx`
- `apps/web/app/actions/api.ts`

Those are the main places to read if you extend the launcher beyond the single-file `config` flow.
