#!/usr/bin/env bash
# Post-commit: bump patch only after a successful git commit on a non-main branch.
#
# Skips:
# - commits on main/master
# - commits that did not touch backend/ (except VERSION)
# - the amend commit created by this hook (recursion guard)
# - manual `pre-commit run` (hook stage is post-commit only)
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
LOCK_FILE="$ROOT/.git/backend-version-bump.lock"

# Recursion guard: skip the amend triggered by this same hook.
if [ -f "$LOCK_FILE" ]; then
  rm -f "$LOCK_FILE"
  exit 0
fi

# Only real post-commit from git. Manual `pre-commit run` without
# --hook-stage post-commit never reaches here; if it does via explicit
# stage, require a git commit context (HEAD exists and reflog action).
if [ "${PRE_COMMIT_SKIP_VERSION_BUMP:-}" = "1" ]; then
  exit 0
fi

branch="$(git -C "$ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")"

case "$branch" in
  main|master)
    exit 0
    ;;
esac

# Inspect files introduced by the commit that just succeeded.
mapfile -t committed < <(
  git -C "$ROOT" diff-tree --no-commit-id --name-only -r HEAD
)

backend_touch=0
for f in "${committed[@]+"${committed[@]}"}"; do
  case "$f" in
    backend/VERSION) continue ;;
    backend/*) backend_touch=1 ;;
  esac
done

if [ "$backend_touch" -eq 0 ]; then
  exit 0
fi

bash "$ROOT/scripts/pre-commit/backend-version-bump.sh" patch

# Fold VERSION into the commit that just succeeded (does not re-run hooks).
touch "$LOCK_FILE"
git -C "$ROOT" commit --amend --no-edit --no-verify
