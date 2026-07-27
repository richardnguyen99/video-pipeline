#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT/frontend"

files=()
for f in "$@"; do
  files+=("${f#frontend/}")
done

if [ ${#files[@]} -eq 0 ]; then
  exit 0
fi

npx prettier --write -- "${files[@]}"
