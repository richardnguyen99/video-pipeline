#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT/backend"

if [ -x "$ROOT/backend/.venv/bin/pytest" ]; then
  PYTEST="$ROOT/backend/.venv/bin/pytest"
elif [ -x "$ROOT/.venv/bin/pytest" ]; then
  PYTEST="$ROOT/.venv/bin/pytest"
else
  PYTEST="pytest"
fi

set +e
"$PYTEST" tests/unit/services -q
code=$?
set -e

# pytest exit code 5 = no tests collected
if [ "$code" -eq 5 ]; then
  exit 0
fi

exit "$code"
