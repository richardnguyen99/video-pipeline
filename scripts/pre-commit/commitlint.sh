#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
MSG_FILE="${1:-}"

if [ -z "$MSG_FILE" ]; then
  echo "commitlint: missing commit message file" >&2
  exit 1
fi

cd "$ROOT/frontend"
npx commitlint --config "$ROOT/frontend/commitlint.config.cjs" --edit "$MSG_FILE"
