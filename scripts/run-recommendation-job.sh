#!/usr/bin/env bash
# Incremental recommendation job for newly inserted videos.
#
# Default behaviour:
#   - Process videos with no rows in video_recommendation (--new-only)
#   - Refresh related sources that share actresses/series (--refresh-related)
#
# Intended for cron / systemd timer, e.g. every 15 minutes:
#   */15 * * * * /path/to/repo/scripts/run-recommendation-job.sh >>/var/log/video-recs.log 2>&1
#
# Optional env:
#   LIMIT=50
#   REFRESH_RELATED=1|0   (default 1)
#   SINCE=2026-09-15T00:00:00   (if set, uses --since instead of --new-only)
#   ENV_FILE=/path/to/.env
#   PYTHON=python3

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.postgres}"
PYTHON="${PYTHON:-python3}"
LIMIT="${LIMIT:-50}"
REFRESH_RELATED="${REFRESH_RELATED:-1}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if [[ -d "$BACKEND_DIR/.venv" ]]; then
  # shellcheck disable=SC1091
  source "$BACKEND_DIR/.venv/bin/activate"
fi

cd "$BACKEND_DIR"

ARGS=(--limit "$LIMIT")

if [[ -n "${SINCE:-}" ]]; then
  ARGS+=(--since "$SINCE")
else
  ARGS+=(--new-only)
fi

if [[ "$REFRESH_RELATED" == "1" ]]; then
  ARGS+=(--refresh-related)
fi

exec "$PYTHON" "$ROOT_DIR/scripts/compute-video-recommendations.py" "${ARGS[@]}"
