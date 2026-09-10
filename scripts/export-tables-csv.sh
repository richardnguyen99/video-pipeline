#!/usr/bin/env bash
# Export selected tables to batched CSV files:
#   <table_name>_<batch_num>.csv
#
# Usage:
#   ./scripts/export-tables-csv.sh
#   ./scripts/export-tables-csv.sh 2026-01-01
#   ./scripts/export-tables-csv.sh '2026-01-01 00:00:00+00'
#   ENV_FILE=.env.export ./scripts/export-tables-csv.sh 2026-03-15T12:00:00Z
#   BATCH_SIZE=5000 SINCE=2026-01-01 ./scripts/export-tables-csv.sh
#
# When a timestamp is given (first CLI arg or SINCE env), only rows with
# created_at strictly after that instant are exported. Tables without a
# created_at column are exported in full.
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

# Prefer CLI timestamp over SINCE env when both are set.
if [[ $# -ge 1 && -n "${1:-}" ]]; then
  SINCE="$1"
fi
SINCE="${SINCE:-}"

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

if [[ -n "$SINCE" ]]; then
  if ! [[ "$SINCE" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}([ T][0-9]{2}:[0-9]{2}(:[0-9]{2}(\.[0-9]+)?)?(Z|[+-][0-9]{2}:?[0-9]{2})?)?$ ]]; then
    echo "Invalid SINCE timestamp: $SINCE" >&2
    echo "Use an ISO-8601-like value, e.g. 2026-01-01 or 2026-01-01T12:00:00Z" >&2
    exit 1
  fi

  if ! "${PSQL[@]}" -v ON_ERROR_STOP=1 -At -c "SELECT '${SINCE}'::timestamptz;" >/dev/null; then
    echo "PostgreSQL could not parse SINCE as timestamptz: $SINCE" >&2
    exit 1
  fi
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

table_has_created_at() {
  local schema="$1"
  local table="$2"

  "${PSQL[@]}" -At -c \
    "SELECT 1
     FROM information_schema.columns
     WHERE table_schema = '${schema}'
       AND table_name = '${table}'
       AND column_name = 'created_at'
     LIMIT 1;"
}

export_table() {
  local qualified="$1"
  local schema="${qualified%%.*}"
  local table="${qualified##*.}"
  local batch=1
  local offset=0
  local out rows
  local where_sql=""
  local order_sql="ORDER BY 1"
  local has_created=""

  echo "=== ${qualified} ==="

  if [[ -n "$SINCE" ]]; then
    has_created="$(table_has_created_at "$schema" "$table" || true)"

    if [[ "$has_created" == "1" ]]; then
      where_sql="WHERE created_at > '${SINCE}'::timestamptz"
      order_sql="ORDER BY created_at, 1"
      echo "  filter: created_at > ${SINCE}"
    else
      echo "  filter: skipped (no created_at column)"
    fi
  fi

  while true; do
    out="${EXPORT_DIR}/${table}_${batch}.csv"
    rows="$("${PSQL[@]}" -v ON_ERROR_STOP=1 -At -c \
      "SELECT COUNT(*) FROM (
         SELECT 1 FROM ${schema}.${table}
         ${where_sql}
         ${order_sql}
         OFFSET ${offset} LIMIT ${BATCH_SIZE}
       ) t;")"

    if [[ -z "$rows" || "$rows" -eq 0 ]]; then
      if [[ "$batch" -eq 1 ]]; then
        "${PSQL[@]}" -v ON_ERROR_STOP=1 -c \
          "\\copy (SELECT * FROM ${schema}.${table} ${where_sql} LIMIT 0) TO STDOUT WITH (FORMAT csv, HEADER true)" \
          >"$out"
        echo "  wrote $out (empty)"
      fi
      break
    fi

    "${PSQL[@]}" -v ON_ERROR_STOP=1 -c \
      "\\copy (
         SELECT * FROM ${schema}.${table}
         ${where_sql}
         ${order_sql}
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
if [[ -n "$SINCE" ]]; then
  echo "Since:       $SINCE (created_at > SINCE)"
else
  echo "Since:       (none — full table export)"
fi
echo

for qualified in "${TABLES[@]}"; do
  export_table "$qualified"
done

echo
echo "Done. Files under $EXPORT_DIR"
