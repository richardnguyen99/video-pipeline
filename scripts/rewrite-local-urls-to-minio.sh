#!/usr/bin/env bash
# Apply rewrite-local-urls-to-minio.sql using env / env file for secrets.
#
# Usage:
#   ENV_FILE=.env.import bash scripts/rewrite-local-urls-to-minio.sh
#   LOCAL_PREFIX=/path/prefix/ \
#   PUBLIC_BASE=http://localhost:9000/video-samples/ \
#     bash scripts/rewrite-local-urls-to-minio.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.import}"
SQL_FILE="$ROOT_DIR/scripts/rewrite-local-urls-to-minio.sql"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

LOCAL_PREFIX="${LOCAL_PREFIX:-/run/media/youknowwho/Jav/hls/}"
PUBLIC_BASE="${PUBLIC_BASE:-http://localhost:9000/video-samples/}"

if [[ -n "${DATABASE_URL:-}" ]]; then
  PSQL=(psql "$DATABASE_URL")
else
  : "${PGHOST:?Set PGHOST or DATABASE_URL}"
  : "${PGPORT:?Set PGPORT or DATABASE_URL}"
  : "${PGUSER:?Set PGUSER or DATABASE_URL}"
  : "${PGPASSWORD:?Set PGPASSWORD or DATABASE_URL}"
  : "${PGDATABASE:?Set PGDATABASE or DATABASE_URL}"
  export PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE
  PSQL=(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE")
fi

echo "LOCAL_PREFIX=$LOCAL_PREFIX"
echo "PUBLIC_BASE=$PUBLIC_BASE"
echo

"${PSQL[@]}" \
  -v local_prefix="$LOCAL_PREFIX" \
  -v public_base="$PUBLIC_BASE" \
  -f "$SQL_FILE"
