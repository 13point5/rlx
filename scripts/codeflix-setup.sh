#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "${ROOT_DIR}"

corepack enable

cd "${ROOT_DIR}/apps/web"
pnpm install --frozen-lockfile

cd "${ROOT_DIR}/apps/api"
python3 -m pip install --no-cache-dir uv
uv sync --frozen
