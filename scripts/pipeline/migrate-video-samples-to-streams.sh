#!/usr/bin/env bash
# Step 1 phase 2: move each video-samples/{uuid}/ folder to streams/{uuid}/
# and repoint video_m3u8 URLs. Idempotent: re-run after interruption.
#
# Required:
#   MinIO reachable via mc alias (default: local)
# Optional:
#   DATABASE_URL or PSQL_URL — when set, also rewrites video_m3u8 URLs
#
# Examples:
#   ./scripts/pipeline/migrate-video-samples-to-streams.sh
#   DATABASE_URL='postgresql://user:pass@localhost:5432/db' \
#     ./scripts/pipeline/migrate-video-samples-to-streams.sh
set -euo pipefail

MC_ALIAS="${MC_ALIAS:-local}"
MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://localhost:9000}"
MINIO_ROOT_USER="${MINIO_ROOT_USER:-minioadmin}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-minioadmin}"
SRC_BUCKET="${SRC_BUCKET:-video-samples}"
DST_BUCKET="${DST_BUCKET:-streams}"
PSQL_URL="${DATABASE_URL:-${PSQL_URL:-}}"
OLD_PATH_MARKER="${OLD_PATH_MARKER:-/video-samples/}"
NEW_PATH_MARKER="${NEW_PATH_MARKER:-/streams/}"

if ! command -v mc >/dev/null 2>&1; then
  echo "mc (MinIO client) is required" >&2
  exit 1
fi

echo "Configuring mc alias '${MC_ALIAS}' → ${MINIO_ENDPOINT}"
mc alias set "$MC_ALIAS" "$MINIO_ENDPOINT" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null

mc mb --ignore-existing "$MC_ALIAS/$DST_BUCKET"
mc anonymous set download "$MC_ALIAS/$DST_BUCKET" >/dev/null

cnt() {
  local path="$1"
  local n
  n=$(mc ls --recursive --summarize "$path" 2>/dev/null | awk '/Total Objects/ {print $3; exit}') || true
  if [ -z "${n:-}" ]; then
    echo 0
  else
    echo "$n"
  fi
}

echo "Listing folders under ${MC_ALIAS}/${SRC_BUCKET} ..."
mapfile -t FOLDERS < <(
  mc ls "${MC_ALIAS}/${SRC_BUCKET}" \
    | awk '{print $NF}' \
    | sed 's|/*$||' \
    | grep -E '^[0-9a-fA-F-]{36}$' || true
)

if [ "${#FOLDERS[@]}" -eq 0 ]; then
  echo "No UUID folders found in ${SRC_BUCKET}."
  echo "Check: mc ls ${MC_ALIAS}/${SRC_BUCKET}"
  exit 1
fi

echo "Found ${#FOLDERS[@]} UUID folder(s) to move."

moved=0
skipped=0

for uuid in "${FOLDERS[@]}"; do
  src_path="${MC_ALIAS}/${SRC_BUCKET}/${uuid}"
  dst_path="${MC_ALIAS}/${DST_BUCKET}/${uuid}"

  src_n=$(cnt "${src_path}/")
  dst_n=$(cnt "${dst_path}/")

  if [ "${src_n}" = "0" ]; then
    echo "skip ${uuid}: source empty (already moved?)"
    skipped=$((skipped + 1))
    continue
  fi

  echo "move ${uuid}: ${src_n} object(s) → ${DST_BUCKET}/${uuid}/ (dest had ${dst_n})"
  mc mv --recursive "${src_path}/" "${dst_path}/"

  after=$(cnt "${dst_path}/")
  expected=$((src_n + dst_n))

  if [ "${after}" != "${expected}" ]; then
    echo "count mismatch for ${uuid}: after=${after} expected=${expected}" >&2
    exit 1
  fi

  echo "ok   ${uuid}: ${after} object(s) in ${DST_BUCKET}"
  moved=$((moved + 1))
done

echo
echo "MinIO summary: moved=${moved} skipped=${skipped}"
echo "streams:"
mc ls "${MC_ALIAS}/${DST_BUCKET}" || true
echo "video-samples (UUID folders only should be gone; watch-events may remain):"
mc ls "${MC_ALIAS}/${SRC_BUCKET}" || true

if [ -z "${PSQL_URL}" ]; then
  echo
  echo "DATABASE_URL / PSQL_URL not set — skipped video_m3u8 URL rewrite."
  echo "After verifying streams looks correct, run:"
  echo "  psql \"\$DATABASE_URL\" -c \"UPDATE video_m3u8 SET m3u8_url = replace(m3u8_url, '/video-samples/', '/streams/'), updated_at = now() WHERE m3u8_url LIKE '%/video-samples/%';\""
  exit 0
fi

echo
echo "Rewriting video_m3u8 URLs (${OLD_PATH_MARKER} → ${NEW_PATH_MARKER}) ..."

psql "$PSQL_URL" -v ON_ERROR_STOP=1 -c \
  "CREATE TABLE IF NOT EXISTS video_m3u8_bak_streams_mig AS SELECT * FROM video_m3u8 WHERE false;"

psql "$PSQL_URL" -v ON_ERROR_STOP=1 -c \
  "INSERT INTO video_m3u8_bak_streams_mig
   SELECT m.* FROM video_m3u8 m
   LEFT JOIN video_m3u8_bak_streams_mig b ON b.id = m.id
   WHERE b.id IS NULL AND m.m3u8_url LIKE '%${OLD_PATH_MARKER}%';"

psql "$PSQL_URL" -v ON_ERROR_STOP=1 -c \
  "UPDATE video_m3u8
   SET m3u8_url = replace(m3u8_url, '${OLD_PATH_MARKER}', '${NEW_PATH_MARKER}'),
       updated_at = now()
   WHERE m3u8_url LIKE '%${OLD_PATH_MARKER}%';"

psql "$PSQL_URL" -v ON_ERROR_STOP=1 -c \
  "SELECT
     count(*) FILTER (WHERE m3u8_url LIKE '%${OLD_PATH_MARKER}%') AS still_old,
     count(*) FILTER (WHERE m3u8_url LIKE '%${NEW_PATH_MARKER}%') AS now_streams
   FROM video_m3u8;"

echo "Done."
