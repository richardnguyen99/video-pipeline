#!/usr/bin/env bash
# Bump backend/VERSION (major.minor.patch).
#
# Modes (env BUMP_MODE or first arg):
#   patch  — increase patch (feature-branch commits)
#   minor  — increase minor, reset patch to 0 (merge into main)
#
# Major is intentional and manual only.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
VERSION_FILE="$ROOT/backend/VERSION"
MODE="${1:-${BUMP_MODE:-patch}}"

if [ ! -f "$VERSION_FILE" ]; then
  echo "0.1.0" > "$VERSION_FILE"
fi

raw="$(tr -d '[:space:]' < "$VERSION_FILE")"
IFS='.' read -r major minor patch <<< "$raw"

if ! [[ "$major" =~ ^[0-9]+$ && "$minor" =~ ^[0-9]+$ && "$patch" =~ ^[0-9]+$ ]]; then
  echo "backend-version-bump: invalid version '$raw' in $VERSION_FILE" >&2
  exit 1
fi

case "$MODE" in
  patch)
    patch=$((patch + 1))
    ;;
  minor)
    minor=$((minor + 1))
    patch=0
    ;;
  major)
    echo "backend-version-bump: major bumps are manual; refuse automatic major" >&2
    exit 1
    ;;
  *)
    echo "backend-version-bump: unknown mode '$MODE'" >&2
    exit 1
    ;;
esac

new="${major}.${minor}.${patch}"
echo "$new" > "$VERSION_FILE"
git -C "$ROOT" add -- "$VERSION_FILE"
echo "backend-version-bump: $raw -> $new ($MODE)"
