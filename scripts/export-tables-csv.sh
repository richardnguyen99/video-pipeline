#!/usr/bin/env bash
# Export selected tables to batched CSV files:
#   <table_name>_<batch_num>.csv
#
# Usage:
#   ./scripts/export-tables-csv.sh
#   ENV_FILE=.env.export ./scripts/export-tables-csv.sh
#   BATCH_SIZE=5000 ./scripts/export-tables-csv.sh
#
# Credentials and destination come from env / env file only.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.export}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

BATCH_SIZE="${BATCH_SIZE:-10000}"
EXPORT_DIR="${EXPORT_DIR:-$ROOT_DIR/exports}"

if [[ -n "${DATABASE_URL:-}" ]]; then
  PSQL=(psql "$DATABASE_URL")
else
  : "${PGHOST:?Set PGHOST or DATABASE_URL (e.g. in .env.export)}"
  : "${PGPORT:?Set PGPORT or DATABASE_URL}"
  : "${PGUSER:?Set PGUSER or DATABASE_URL}"
  : "${PGDATABASE:?Set PGDATABASE or DATABASE_URL}"
  : "${PGPASSWORD:?Set PGPASSWORD or DATABASE_URL}"
  export PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE
  PSQL=(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE")
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found on PATH. Install client tools or run inside a postgres container." >&2
  exit 1
fi

mkdir -p "$EXPORT_DIR"

# schema.table pairs (physical names match SQLModel / association tables)
DEFAULT_TABLES=(
  public.video
  public.video_aka
  public.video_image_url
  public.video_m3u8
  public.video_sample_image_url
  public.video_sample_movie_url
  app_user_schema.video_view
  app_user_schema.video_reaction
  app_user_schema.user
  app_user_schema.user_actress_subscribe
  public.series
  public.series_aka
  public.video_series
  public.maker
  public.maker_aka
  public.video_maker
  public.label
  public.label_aka
  public.video_label
  public.genre
  public.genre_aka
  public.video_genre
  public.director
  public.director_aka
  public.video_director
  app_user_schema.refresh_token
  app_user_schema.playlist
  app_user_schema.playlist_video
  app_user_schema.playlist_share
  app_user_schema.user_credential
  app_user_schema.comment
  public.actress
  public.actress_image
  public.actress_aka
  public.video_actress
)

if [[ -n "${EXPORT_TABLES:-}" ]]; then
  mapfile -t TABLE_FILTER <<< "$EXPORT_TABLES"
  TABLES=()
  for qualified in "${DEFAULT_TABLES[@]}"; do
    name="${qualified##*.}"
    for want in "${TABLE_FILTER[@]}"; do
      if [[ "$name" == "$want" || "$qualified" == "$want" ]]; then
        TABLES+=("$qualified")
        break
      fi
    done
  done
else
  TABLES=("${DEFAULT_TABLES[@]}")
fi

export_table() {
  local qualified="$1"
  local schema="${qualified%%.*}"
  local table="${qualified##*.}"
  local batch=1
  local offset=0
  local out rows

  echo "=== ${qualified} ==="

  while true; do
    out="${EXPORT_DIR}/${table}_${batch}.csv"
    # COPY TO STDOUT with LIMIT/OFFSET via subquery
    rows="$("${PSQL[@]}" -v ON_ERROR_STOP=1 -At -c \
      "SELECT COUNT(*) FROM (
         SELECT 1 FROM ${schema}.${table}
         ORDER BY 1
         OFFSET ${offset} LIMIT ${BATCH_SIZE}
       ) t;")"

    if [[ -z "$rows" || "$rows" -eq 0 ]]; then
      if [[ "$batch" -eq 1 ]]; then
        # empty table: still emit one header-only file
        "${PSQL[@]}" -v ON_ERROR_STOP=1 -c \
          "\\copy (SELECT * FROM ${schema}.${table} LIMIT 0) TO STDOUT WITH (FORMAT csv, HEADER true)" \
          >"$out"
        echo "  wrote $out (empty)"
      fi
      break
    fi

    "${PSQL[@]}" -v ON_ERROR_STOP=1 -c \
      "\\copy (
         SELECT * FROM ${schema}.${table}
         ORDER BY 1
         OFFSET ${offset} LIMIT ${BATCH_SIZE}
       ) TO STDOUT WITH (FORMAT csv, HEADER true)" \
      >"$out"

    echo "  wrote $out (${rows} rows)"
    offset=$((offset + BATCH_SIZE))
    batch=$((batch + 1))
  done
}

echo "Export dir:  $EXPORT_DIR"
echo "Batch size:  $BATCH_SIZE"
echo "Tables:      ${#TABLES[@]}"
echo

for qualified in "${TABLES[@]}"; do
  export_table "$qualified"
done

echo
echo "Done. Files under $EXPORT_DIR"
