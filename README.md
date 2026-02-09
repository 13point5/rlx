# rlx

RLX is a web platform for managing reinforcement-learning experiment runs from GitHub repositories.

## Docker dev stack

This repo now includes a Docker Compose setup so environments can be bootstrapped without embedding RLX-specific install steps in external automation scripts.

### 1) Create local env files

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local
```

Fill in required secrets (Clerk, database, etc.) in those local files.

### 2) Start full stack (web + api + redis + celery)

```bash
docker compose up --build
```

- Web: `http://localhost:3000`
- API: `http://localhost:8000`
- Redis: `localhost:6379`
- Worker: `worker` service (Celery queue consumer)
- Scheduler: `scheduler` service (Celery beat)

## Sandbox note

For cloud sandbox runs, add sandbox-specific env files in the app directories:

```bash
cp apps/api/.env apps/api/.env.sandbox
cp apps/web/.env.local apps/web/.env.sandbox
```

Then set `REDIS_URL` in `apps/api/.env.sandbox` to your managed Redis URL:

```bash
REDIS_URL=rediss://default:<url_encoded_password>@redis-xxxx.cloud.redislabs.com:16965/0
```

If the password contains special characters (`@`, `:`, `/`, `#`, `%`, etc.), URL-encode it first.

## Codeflix automation config

This repo includes `codeflix.json` for sandbox automation. It runs:

- `setup`: `bash scripts/codeflix-setup.sh`
- `run`: `bash scripts/codeflix-run.sh`

Both scripts assume sandbox env files exist:

- `apps/api/.env.sandbox`
- `apps/web/.env.sandbox`
