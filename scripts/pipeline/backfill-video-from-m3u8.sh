#!/usr/bin/env bash
# Orchestrate Model B backfill for legacy streamed videos:
#   1) video.public_id / status / ready_at from video_m3u8
#   2) video_rendition rows from streams/{public_id}/{label}/
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PSQL_URL="${DATABASE_URL:-${PSQL_URL:-}}"

if [ -z "${PSQL_URL}" ]; then
  echo "DATABASE_URL or PSQL_URL is required" >&2
  exit 1
fi

echo "=== 1/2 video columns from m3u8 ==="
psql "$PSQL_URL" -v ON_ERROR_STOP=1 -f "$ROOT/scripts/sql/backfill-video-from-m3u8.sql"

echo
echo "=== 2/2 video_rendition from MinIO streams ==="
exec "$ROOT/scripts/pipeline/backfill-video-renditions.sh"
