#!/usr/bin/env bash
# Backfill video_rendition rows for legacy HLS packages under streams/{public_id}/.
# Discovers labels (360p, 480p, 720p, 1080p, …) via mc and inserts READY rows.
#
# Prerequisites:
#   - video.public_id already set (run scripts/sql/backfill-video-from-m3u8.sql first)
#   - mc alias configured
#   - DATABASE_URL or PSQL_URL
#
# Safe to re-run (skips existing (video_id, label) pairs).
set -euo pipefail

MC_ALIAS="${MC_ALIAS:-local}"
MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://localhost:9000}"
MINIO_ROOT_USER="${MINIO_ROOT_USER:-minioadmin}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-minioadmin}"
STREAMS_BUCKET="${STREAMS_BUCKET:-streams}"
PSQL_URL="${DATABASE_URL:-${PSQL_URL:-}}"

if [ -z "${PSQL_URL}" ]; then
  echo "DATABASE_URL or PSQL_URL is required" >&2
  exit 1
fi

if ! command -v mc >/dev/null 2>&1; then
  echo "mc is required" >&2
  exit 1
fi

mc alias set "$MC_ALIAS" "$MINIO_ENDPOINT" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null

# Ladder defaults from docs/video-encoding-to-stream-pipeline.md (16:9 widths).
dims_for_label() {
  case "$1" in
    240p) echo "426 240 400" ;;
    360p) echo "640 360 800" ;;
    480p) echo "854 480 1400" ;;
    720p) echo "1280 720 2800" ;;
    1080p) echo "1920 1080 5000" ;;
    *) echo "" ;;
  esac
}

echo "Loading videos with public_id and m3u8 ..."
mapfile -t ROWS < <(
  psql -At -F$'\t' "$PSQL_URL" -c "
    SELECT v.id, v.public_id::text
    FROM video v
    WHERE v.public_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM video_m3u8 m WHERE m.fk_id = v.id)
    ORDER BY v.id;
  "
)

if [ "${#ROWS[@]}" -eq 0 ]; then
  echo "No videos with public_id + m3u8. Run scripts/sql/backfill-video-from-m3u8.sql first."
  exit 1
fi

inserted=0
skipped=0

for row in "${ROWS[@]}"; do
  video_pk="${row%%$'\t'*}"
  public_id="${row#*$'\t'}"

  mapfile -t LABELS < <(
    mc ls "${MC_ALIAS}/${STREAMS_BUCKET}/${public_id}/" 2>/dev/null \
      | awk '{print $NF}' \
      | sed 's|/*$||' \
      | grep -E '^[0-9]+p$' || true
  )

  if [ "${#LABELS[@]}" -eq 0 ]; then
    echo "warn video_id=${video_pk} public_id=${public_id}: no rendition folders"
    continue
  fi

  for label in "${LABELS[@]}"; do
    dims=$(dims_for_label "$label")
    if [ -z "$dims" ]; then
      echo "warn skip unknown label=${label} video_id=${video_pk}"
      continue
    fi
    read -r width height kbps <<<"$dims"

    playlist_key="${public_id}/${label}/playlist.m3u8"
    segment_count=$(
      mc ls "${MC_ALIAS}/${STREAMS_BUCKET}/${public_id}/${label}/" 2>/dev/null \
        | grep -cE 'seg_[0-9]+\.(ts|m4s)$' || true
    )

    result=$(psql -At "$PSQL_URL" -v ON_ERROR_STOP=1 -c "
      INSERT INTO video_rendition (
        video_id, label, width, height, video_kbps,
        playlist_key, segment_count, status, progress_pct, attempt
      ) VALUES (
        ${video_pk},
        '${label}',
        ${width},
        ${height},
        ${kbps},
        '${playlist_key}',
        NULLIF(${segment_count}, 0),
        'READY',
        100,
        0
      )
      ON CONFLICT (video_id, label) DO UPDATE
        SET playlist_key = EXCLUDED.playlist_key,
            segment_count = COALESCE(EXCLUDED.segment_count, video_rendition.segment_count),
            status = 'READY',
            progress_pct = 100,
            updated_at = now()
      RETURNING (xmax = 0) AS inserted;
    ")

    if [ "${result}" = "t" ]; then
      inserted=$((inserted + 1))
      echo "insert video_id=${video_pk} label=${label} segs=${segment_count}"
    else
      skipped=$((skipped + 1))
      echo "update video_id=${video_pk} label=${label} segs=${segment_count}"
    fi
  done
done

echo
echo "Summary: inserted_or_new=${inserted} updated=${skipped}"
psql "$PSQL_URL" -c "
  SELECT status, count(*) FROM video_rendition GROUP BY status ORDER BY 1;
  SELECT video_id, label, width, height, video_kbps, segment_count, status
  FROM video_rendition
  ORDER BY video_id, label
  LIMIT 40;
"
