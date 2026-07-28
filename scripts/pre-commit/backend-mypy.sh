#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT/backend"

files=()
for f in "$@"; do
  rel="${f#backend/}"
  case "$rel" in
    alembic/*|*/alembic/*) continue ;;
  esac
  files+=("$rel")
done

if [ ${#files[@]} -eq 0 ]; then
  exit 0
fi

if [ -x "$ROOT/backend/.venv/bin/mypy" ]; then
  MYPY="$ROOT/backend/.venv/bin/mypy"
elif [ -x "$ROOT/.venv/bin/mypy" ]; then
  MYPY="$ROOT/.venv/bin/mypy"
else
  MYPY="mypy"
fi

"$MYPY" --config-file pyproject.toml -- "${files[@]}"
