#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cleanup() {
  jobs -p | xargs -r kill >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM

cd "${ROOT_DIR}/apps/api"
uv run uvicorn rlx_api.main:app --host 0.0.0.0 --port 8000 &
uv run celery -A rlx_api.celery_app:celery_app worker --loglevel=info -Q pod_ops,repo_ops &
uv run celery -A rlx_api.celery_app:celery_app beat --loglevel=info &

cd "${ROOT_DIR}/apps/web"
pnpm dev --hostname 0.0.0.0 --port 3000 &

wait -n
