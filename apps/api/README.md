# RLX API

## Setup

1. Install dependencies

```bash
uv sync
```

2. Copy `.env.example` to `.env` and configure environment variables

## Running the Server

```bash
uv run uvicorn main:app --reload --port 8000
```

## Job Queue (Celery + Redis)

The job queue system uses Celery with Redis for executing async tasks like cloning repos and running commands on GPU pods.

### 1. Start Redis

Run Redis locally using Docker:

```bash
docker run -d --name redis -p 6379:6379 redis:7-alpine
```

Add to your `.env`:

```bash
REDIS_URL=redis://localhost:6379/0
```

### 2. Run Database Migrations

Ensure the `jobs` and `job_commands` tables exist:

```bash
uv run alembic upgrade head
```

### 3. Start Celery Worker

In a separate terminal. **Note:** `PYTHONPATH=.` is required so workers can import `database`, `services`, etc.:

```bash
PYTHONPATH=. uv run celery -A celery_app worker --loglevel=info -Q pod_ops,repo_ops
```

### 4. Start Celery Beat (Scheduler)

In another terminal (optional, for periodic job checking):

```bash
PYTHONPATH=. uv run celery -A celery_app beat --loglevel=info
```

### Monitoring with Flower (Optional)

For a web UI to monitor tasks:

```bash
uv add flower
uv run celery -A celery_app flower --port=5555
```

Then open http://localhost:5555
