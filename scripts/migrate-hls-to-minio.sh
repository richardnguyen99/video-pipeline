#!/usr/bin/env bash
# Migrate existing on-disk HLS packages into MinIO (external-drive backed).
#
# Usage:
#   ./scripts/migrate-hls-to-minio.sh
#   ENV_FILE=.env.minio ./scripts/migrate-hls-to-minio.sh
#   MAX_RETRIES=8 ./scripts/migrate-hls-to-minio.sh
#   ONLY_UUID=2f5df3b9-c0bc-5119-a060-01cb867863fd ./scripts/migrate-hls-to-minio.sh
#
# Requires: Docker, MinIO already running via docker-compose.minio.yml
#
# External USB/HDD reads often fail mid-PUT with:
#   "You did not provide the number of bytes specified by the Content-Length"
# This script uses single-worker uploads and retries until a package succeeds.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.minio}"
MAX_RETRIES="${MAX_RETRIES:-6}"
ONLY_UUID="${ONLY_UUID:-}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy .env.minio.example and set paths." >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

: "${HLS_SOURCE_DIR:?HLS_SOURCE_DIR must be set in $ENV_FILE}"
: "${MINIO_DATA_DIR:?MINIO_DATA_DIR must be set in $ENV_FILE}"
MINIO_BUCKET="${MINIO_BUCKET:-video-samples}"
MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://localhost:9000}"
MINIO_ROOT_USER="${MINIO_ROOT_USER:-minioadmin}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-minioadmin}"

if [[ ! -d "$HLS_SOURCE_DIR" ]]; then
  echo "HLS source not found: $HLS_SOURCE_DIR" >&2
  exit 1
fi

if [[ ! -d "$MINIO_DATA_DIR" ]]; then
  echo "Creating MinIO data dir: $MINIO_DATA_DIR"
  mkdir -p "$MINIO_DATA_DIR"
fi

echo "Source HLS:  $HLS_SOURCE_DIR"
echo "MinIO data:  $MINIO_DATA_DIR (container /data)"
echo "Bucket:      $MINIO_BUCKET"
echo "Endpoint:    $MINIO_ENDPOINT"
echo "Retries:     $MAX_RETRIES per package (max-workers=1)"
echo

# One docker invocation that retries each UUID until mirror exits 0.
docker run --rm --network host \
  --entrypoint /bin/sh \
  -e MINIO_ENDPOINT="$MINIO_ENDPOINT" \
  -e MINIO_ROOT_USER="$MINIO_ROOT_USER" \
  -e MINIO_ROOT_PASSWORD="$MINIO_ROOT_PASSWORD" \
  -e MINIO_BUCKET="$MINIO_BUCKET" \
  -e MAX_RETRIES="$MAX_RETRIES" \
  -e ONLY_UUID="$ONLY_UUID" \
  -v "${HLS_SOURCE_DIR}:/hls:ro" \
  minio/mc -c '
    set -u
    mc alias set local "$MINIO_ENDPOINT" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
    mc mb --ignore-existing "local/${MINIO_BUCKET}"
    mc anonymous set download "local/${MINIO_BUCKET}" || true

    mirror_once() {
      src="$1"
      dest="$2"
      # Single worker: parallel PUTs amplify flaky USB short-reads.
      mc mirror --overwrite --max-workers 1 "$src" "$dest"
    }

    upload_tree_sequential() {
      # Fallback: one file at a time (slow, more resilient on bad links).
      src_root="$1"
      dest_prefix="$2"
      find "$src_root" -type f | sort | while IFS= read -r f; do
        rel="${f#"$src_root"/}"
        attempt=1
        while [ "$attempt" -le "$MAX_RETRIES" ]; do
          if mc cp --quiet "$f" "${dest_prefix}/${rel}"; then
            break
          fi
          echo "  retry $attempt/$MAX_RETRIES: $rel" >&2
          attempt=$((attempt + 1))
          sleep 2
        done
        if [ "$attempt" -gt "$MAX_RETRIES" ]; then
          echo "  FAILED permanently: $rel" >&2
          return 1
        fi
      done
    }

    failed=""
    for dir in /hls/*; do
      [ -d "$dir" ] || continue
      uuid=$(basename "$dir")
      if [ -n "$ONLY_UUID" ] && [ "$uuid" != "$ONLY_UUID" ]; then
        continue
      fi

      dest="local/${MINIO_BUCKET}/${uuid}"
      echo "=== Package $uuid ==="
      ok=0
      attempt=1
      while [ "$attempt" -le "$MAX_RETRIES" ]; do
        echo "Mirror attempt $attempt/$MAX_RETRIES ..."
        if mirror_once "$dir/" "${dest}/"; then
          ok=1
          break
        fi
        echo "Mirror failed (Content-Length / I/O). Waiting before retry..."
        attempt=$((attempt + 1))
        sleep 3
      done

      if [ "$ok" -ne 1 ]; then
        echo "Falling back to sequential per-file upload for $uuid ..."
        if upload_tree_sequential "$dir" "$dest"; then
          ok=1
        fi
      fi

      if [ "$ok" -ne 1 ]; then
        echo "FAILED: $uuid" >&2
        failed="$failed $uuid"
      else
        echo "OK: $uuid"
      fi
      echo
    done

    if [ -n "$failed" ]; then
      echo "Packages still failing:$failed" >&2
      exit 1
    fi
    echo "All packages migrated."
  '
