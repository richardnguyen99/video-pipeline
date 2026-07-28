#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT/backend"

files=()
for f in "$@"; do
  rel="${f#backend/}"
  # Skip alembic migration tree and env
  case "$rel" in
    alembic/*|*/alembic/*) continue ;;
  esac
  files+=("$rel")
done

if [ ${#files[@]} -eq 0 ]; then
  exit 0
fi

if [ -x "$ROOT/backend/.venv/bin/black" ]; then
  BLACK="$ROOT/backend/.venv/bin/black"
elif [ -x "$ROOT/.venv/bin/black" ]; then
  BLACK="$ROOT/.venv/bin/black"
else
  BLACK="black"
fi

"$BLACK" --config pyproject.toml -- "${files[@]}"
