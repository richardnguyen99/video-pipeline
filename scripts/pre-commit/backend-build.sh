#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT/backend"

if [ -x "$ROOT/backend/.venv/bin/python" ]; then
  PYTHON="$ROOT/backend/.venv/bin/python"
elif [ -x "$ROOT/.venv/bin/python" ]; then
  PYTHON="$ROOT/.venv/bin/python"
else
  PYTHON="python3"
fi

# Production readiness: bytecode compile + import the FastAPI app
"$PYTHON" -m compileall -q app
"$PYTHON" -c "from app.main import app; print('backend build ok:', type(app).__name__)"
