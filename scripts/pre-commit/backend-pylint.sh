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

if [ -x "$ROOT/backend/.venv/bin/pylint" ]; then
  PYLINT="$ROOT/backend/.venv/bin/pylint"
elif [ -x "$ROOT/.venv/bin/pylint" ]; then
  PYLINT="$ROOT/.venv/bin/pylint"
else
  PYLINT="pylint"
fi

"$PYLINT" --rcfile=.pylintrc -- "${files[@]}"
