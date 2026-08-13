#!/usr/bin/env bash
# Post-merge: bump minor only after a successful merge onto main/master.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"

if [ "${PRE_COMMIT_SKIP_VERSION_BUMP:-}" = "1" ]; then
  exit 0
fi

branch="$(git -C "$ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")"

case "$branch" in
  main|master) ;;
  *) exit 0 ;;
esac

bash "$ROOT/scripts/pre-commit/backend-version-bump.sh" minor

# post-merge cannot amend the merge commit safely in all cases; create a
# follow-up commit when the tree is otherwise clean.
if [ -n "$(git -C "$ROOT" status --porcelain | grep -v 'backend/VERSION' || true)" ]; then
  echo "backend-version-bump-minor: VERSION staged; commit manually when ready"
  exit 0
fi

if git -C "$ROOT" diff --cached --quiet -- backend/VERSION 2>/dev/null \
  && [ -z "$(git -C "$ROOT" status --porcelain -- backend/VERSION)" ]; then
  exit 0
fi

git -C "$ROOT" commit --no-verify -m "chore(backend): bump minor version after merge" -- backend/VERSION
