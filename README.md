# rlx

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
