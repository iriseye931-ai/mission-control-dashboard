#!/bin/zsh
set -euo pipefail

BACKEND_DIR="/Users/iris/Projects/mission-control-dashboard/backend"
VENV_UVICORN="$BACKEND_DIR/venv/bin/uvicorn"

cd "$BACKEND_DIR"
exec "$VENV_UVICORN" main:app --host 0.0.0.0 --port 8000
