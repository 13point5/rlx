#!/bin/bash

SESSION="rlx"

# Check if session already exists
if tmux has-session -t "$SESSION" 2>/dev/null; then
    echo "Error: tmux session '$SESSION' already exists." >&2
    echo "Use 'tmux attach -t $SESSION' to attach or 'tmux kill-session -t $SESSION' to kill it." >&2
    exit 1
fi

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Create new session with first window (web)
tmux new-session -d -s "$SESSION" -n web -c "$SCRIPT_DIR/apps/web"
tmux send-keys -t "$SESSION:web" "pnpm dev" Enter

# Window 2: api
tmux new-window -t "$SESSION" -n api -c "$SCRIPT_DIR/apps/api"
tmux send-keys -t "$SESSION:api" "uv run uvicorn main:app --reload --port 8000" Enter

# Window 3: redis
tmux new-window -t "$SESSION" -n redis -c "$SCRIPT_DIR"
# Check if Redis is already running
if docker ps --format '{{.Names}}' | grep -q '^redis$'; then
    tmux send-keys -t "$SESSION:redis" "echo 'Redis is already running. Use: docker logs -f redis'" Enter
else
    # Remove stopped container if it exists
    if docker ps -a --format '{{.Names}}' | grep -q '^redis$'; then
        docker rm redis >/dev/null 2>&1
    fi
    tmux send-keys -t "$SESSION:redis" "docker run --rm --name redis -p 6379:6379 redis:7-alpine" Enter
fi

# Window 4: worker (wait a moment for redis to start)
tmux new-window -t "$SESSION" -n worker -c "$SCRIPT_DIR/apps/api"
tmux send-keys -t "$SESSION:worker" "sleep 2 && PYTHONPATH=. uv run celery -A celery_app worker --loglevel=info -Q pod_ops,repo_ops" Enter

# Window 5: scheduler
tmux new-window -t "$SESSION" -n scheduler -c "$SCRIPT_DIR/apps/api"
tmux send-keys -t "$SESSION:scheduler" "sleep 2 && PYTHONPATH=. uv run celery -A celery_app beat --loglevel=info" Enter

# Select first window (web)
tmux select-window -t "$SESSION:web"

# Attach to the session
tmux attach -t "$SESSION"
