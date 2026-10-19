#!/usr/bin/env bash
# Step 0: inventory MinIO folders and Postgres URL patterns for the
# video encoding-to-stream migration. Read-only.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MC_ALIAS="${MC_ALIAS:-local}"
MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://localhost:9000}"
MINIO_ROOT_USER="${MINIO_ROOT_USER:-minioadmin}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-minioadmin}"
LEGACY_BUCKET="${LEGACY_BUCKET:-video-samples}"
PSQL_URL="${DATABASE_URL:-${PSQL_URL:-}}"

echo "=== MinIO alias ==="
if command -v mc >/dev/null 2>&1; then
  mc alias set "$MC_ALIAS" "$MINIO_ENDPOINT" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
  echo "Buckets:"
  mc ls "$MC_ALIAS" || true
  echo
  echo "Summarize $LEGACY_BUCKET:"
  mc ls --recursive --summarize "$MC_ALIAS/$LEGACY_BUCKET" 2>/dev/null || echo "(bucket missing or empty)"
  echo
  echo "Absolute URL hits in index.m3u8 (expect 0 per folder):"
  mc ls "$MC_ALIAS/$LEGACY_BUCKET" 2>/dev/null | awk '{print $NF}' | while read -r folder; do
    [ -z "$folder" ] && continue
    folder="${folder%/}"
    hits=$(mc cat "$MC_ALIAS/$LEGACY_BUCKET/${folder}/index.m3u8" 2>/dev/null | grep -c 'http' || true)
    echo "  $folder $hits"
  done
else
  echo "mc not installed; skip MinIO inventory"
fi

echo
echo "=== Postgres URL patterns ==="
if [ -n "$PSQL_URL" ] && command -v psql >/dev/null 2>&1; then
  psql "$PSQL_URL" -v ON_ERROR_STOP=1 <<'SQL'
SELECT 'video' AS table_name, count(*)::bigint AS n FROM video
UNION ALL SELECT 'video_m3u8', count(*) FROM video_m3u8
UNION ALL SELECT 'video_m3u8 video-samples', count(*) FROM video_m3u8 WHERE m3u8_url LIKE '%/video-samples/%'
UNION ALL SELECT 'video_m3u8 streams', count(*) FROM video_m3u8 WHERE m3u8_url LIKE '%/streams/%'
ORDER BY 1;

SELECT
  regexp_replace(m3u8_url, '^(https?://[^/]+).*$', '\1') AS host,
  count(*) AS n
FROM video_m3u8
GROUP BY 1
ORDER BY n DESC;
SQL
else
  echo "Set DATABASE_URL or PSQL_URL and ensure psql is available to run SQL inventory."
fi

echo
echo "Done. Paste output into docs/video-pipeline-baseline-inventory.md"
