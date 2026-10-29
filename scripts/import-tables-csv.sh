#!/usr/bin/env bash
# Import batched CSV files produced by export-tables-csv.sh:
#   <table_name>_<batch_num>.csv
#
# Usage:
#   ./scripts/import-tables-csv.sh
#   ENV_FILE=.env.import ./scripts/import-tables-csv.sh
#   TRUNCATE_BEFORE_IMPORT=true ./scripts/import-tables-csv.sh
#
# Credentials and paths come from env / env file only.
# Tables are loaded in FK-safe order; batches for each table are sorted
# numerically (table_1.csv, table_2.csv, ...).
#
# Conflict handling (ON_CONFLICT_SKIP=true, default):
#   - Existing rows are never updated in place.
#   - video rows that share a business video_id with a live row are skipped
#     (and their child/assoc rows in the batch are dropped).
#   - video rows that only collide on numeric id get a new id; child tables
#     (images, samples, associations) rewrite fk_id / video_id via a map so
#     relations stay attached to the imported video, not the local one.
#   - Child serial primary keys that collide are renumbered before insert.
#   - After load, every public serial/identity sequence is set to MAX(column).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.import}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

IMPORT_DIR="${IMPORT_DIR:-$ROOT_DIR/exports}"
TRUNCATE_BEFORE_IMPORT="${TRUNCATE_BEFORE_IMPORT:-false}"
ON_CONFLICT_SKIP="${ON_CONFLICT_SKIP:-true}"

if [[ -n "${DATABASE_URL:-}" ]]; then
  PSQL=(psql "$DATABASE_URL")
else
  : "${PGHOST:?Set PGHOST or DATABASE_URL (e.g. in .env.import)}"
  : "${PGPORT:?Set PGPORT or DATABASE_URL}"
  : "${PGUSER:?Set PGUSER or DATABASE_URL}"
  : "${PGPASSWORD:?Set PGPASSWORD or DATABASE_URL}"
  : "${PGDATABASE:?Set PGDATABASE or DATABASE_URL}"
  export PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE
  PSQL=(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE")
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found on PATH. Install client tools or run inside a postgres container." >&2
  exit 1
fi

if [[ ! -d "$IMPORT_DIR" ]]; then
  echo "Import directory not found: $IMPORT_DIR" >&2
  exit 1
fi

# FK-safe load order (parents before children).
IMPORT_ORDER=(
  user
  actress
  series
  maker
  label
  genre
  director
  actress_aka
  actress_image
  series_aka
  maker_aka
  label_aka
  genre_aka
  director_aka
  video
  video_aka
  video_image_url
  video_m3u8
  video_sample_image_url
  video_sample_movie_url
  video_actress
  video_series
  video_maker
  video_label
  video_genre
  video_director
  user_credential
  refresh_token
  user_actress_subscribe
  video_view
  video_reaction
  playlist
  playlist_video
  playlist_share
  comment
)

if [[ -n "${IMPORT_TABLES:-}" ]]; then
  # shellcheck disable=SC2206
  FILTER=($IMPORT_TABLES)
  ORDER=()
  for table in "${IMPORT_ORDER[@]}"; do
    for want in "${FILTER[@]}"; do
      if [[ "$table" == "$want" ]]; then
        ORDER+=("$table")
        break
      fi
    done
  done
else
  ORDER=("${IMPORT_ORDER[@]}")
fi

# Only <table>_<digits>.csv — not actress_aka when table=actress.
list_batches() {
  local table="$1"
  local f base num
  local -a files=()

  shopt -s nullglob
  for f in "$IMPORT_DIR"/"${table}"_*.csv; do
    base=$(basename "$f")
    # Exact: table_123.csv
    if [[ "$base" =~ ^${table}_([0-9]+)\.csv$ ]]; then
      num="${BASH_REMATCH[1]}"
      files+=("$num $f")
    fi
  done
  shopt -u nullglob

  if [[ ${#files[@]} -eq 0 ]]; then
    return 0
  fi

  local line
  while IFS= read -r line; do
    # shellcheck disable=SC2086
    set -- $line
    echo "$2"
  done < <(printf '%s\n' "${files[@]}" | sort -n)
}

quote_ident() {
  # Double-quote SQL identifier (user is reserved).
  local name="$1"
  printf '"%s"' "${name//\"/\"\"}"
}

truncate_tables() {
  local tables=("$@")
  local qualified=()
  local t
  for t in "${tables[@]}"; do
    qualified+=("public.$(quote_ident "$t")")
  done
  local reversed=()
  local i
  for ((i = ${#qualified[@]} - 1; i >= 0; i--)); do
    reversed+=("${qualified[i]}")
  done
  local joined
  joined=$(IFS=,; echo "${reversed[*]}")
  echo "TRUNCATE $joined CASCADE"
  "${PSQL[@]}" -v ON_ERROR_STOP=1 -c \
    "TRUNCATE TABLE ${joined} RESTART IDENTITY CASCADE;"
}

csv_header_columns() {
  local file="$1"
  # First line → quoted column list for COPY (header order).
  local header
  header=$(head -n 1 "$file" | tr -d '\r')
  local IFS=','
  # shellcheck disable=SC2206
  local -a cols=($header)
  local out=()
  local c
  for c in "${cols[@]}"; do
    c="${c#"${c%%[![:space:]]*}"}"
    c="${c%"${c##*[![:space:]]}"}"
    c="${c#\"}"
    c="${c%\"}"
    out+=("$(quote_ident "$c")")
  done
  local IFS=,
  echo "${out[*]}"
}

# Child tables that reference video.id via fk_id.
VIDEO_FK_ID_TABLES="|video_aka|video_image_url|video_m3u8|video_sample_image_url|video_sample_movie_url|"
# Junction tables that reference video.id via video_id.
VIDEO_ASSOC_TABLES="|video_actress|video_series|video_maker|video_label|video_genre|video_director|"

ensure_video_id_maps() {
  "${PSQL[@]}" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS public._import_video_id_map (
  old_id integer PRIMARY KEY,
  new_id integer NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS public._import_video_id_skip (
  old_id integer PRIMARY KEY
);
SQL
}

drop_video_id_maps() {
  "${PSQL[@]}" -v ON_ERROR_STOP=1 <<'SQL'
DROP TABLE IF EXISTS public._import_video_id_map;
DROP TABLE IF EXISTS public._import_video_id_skip;
SQL
}

import_file() {
  local table="$1"
  local file="$2"
  local cols
  cols=$(csv_header_columns "$file")
  local qtable
  qtable=$(quote_ident "$table")

  if [[ "$ON_CONFLICT_SKIP" != "true" ]]; then
    echo "  \\copy public.${qtable} (${cols}) FROM $(basename "$file")"
    "${PSQL[@]}" -v ON_ERROR_STOP=1 -c \
      "\\copy public.${qtable} (${cols}) FROM '${file}' WITH (FORMAT csv, HEADER true)"
    return
  fi

  echo "  stage+remap public.${qtable} FROM $(basename "$file")"

  if [[ "$table" == "video" ]]; then
    "${PSQL[@]}" -v ON_ERROR_STOP=1 <<SQL
DROP TABLE IF EXISTS _csv_stage;
CREATE TEMP TABLE _csv_stage (LIKE public.${qtable} INCLUDING DEFAULTS);
\copy _csv_stage (${cols}) FROM '${file}' WITH (FORMAT csv, HEADER true)

-- Same business video_id as a live row: keep local, skip import of that id.
INSERT INTO public._import_video_id_skip (old_id)
SELECT s.id
FROM _csv_stage s
WHERE EXISTS (
  SELECT 1 FROM public.video v WHERE v.video_id = s.video_id
)
ON CONFLICT (old_id) DO NOTHING;

DELETE FROM _csv_stage s
WHERE EXISTS (
  SELECT 1 FROM public._import_video_id_skip k WHERE k.old_id = s.id
);

-- Numeric id collides with a different live video: assign a fresh id and map it.
WITH base AS (
  SELECT GREATEST(
    COALESCE((SELECT MAX(id) FROM public.video), 0),
    COALESCE((SELECT MAX(id) FROM _csv_stage), 0),
    COALESCE((SELECT MAX(new_id) FROM public._import_video_id_map), 0)
  ) AS lo
),
conflicts AS (
  SELECT s.id AS old_id,
         base.lo + ROW_NUMBER() OVER (ORDER BY s.id)::integer AS new_id
  FROM _csv_stage s
  CROSS JOIN base
  WHERE EXISTS (SELECT 1 FROM public.video v WHERE v.id = s.id)
    AND NOT EXISTS (
      SELECT 1 FROM public._import_video_id_map m WHERE m.old_id = s.id
    )
)
INSERT INTO public._import_video_id_map (old_id, new_id)
SELECT old_id, new_id FROM conflicts;

UPDATE _csv_stage s
SET id = m.new_id
FROM public._import_video_id_map m
WHERE s.id = m.old_id;

INSERT INTO public.${qtable} (${cols})
SELECT ${cols} FROM _csv_stage
ON CONFLICT DO NOTHING;

DROP TABLE IF EXISTS _csv_stage;
SQL
    return
  fi

  if [[ "$VIDEO_FK_ID_TABLES" == *"|${table}|"* ]]; then
    "${PSQL[@]}" -v ON_ERROR_STOP=1 <<SQL
DROP TABLE IF EXISTS _csv_stage;
CREATE TEMP TABLE _csv_stage (LIKE public.${qtable} INCLUDING DEFAULTS);
\copy _csv_stage (${cols}) FROM '${file}' WITH (FORMAT csv, HEADER true)

-- Drop children of videos skipped for business-key collision.
DELETE FROM _csv_stage s
WHERE EXISTS (
  SELECT 1 FROM public._import_video_id_skip k WHERE k.old_id = s.fk_id
);

-- Point children at remapped video ids.
UPDATE _csv_stage s
SET fk_id = m.new_id
FROM public._import_video_id_map m
WHERE s.fk_id = m.old_id;

-- Renumber child PK when it would collide with a live row.
WITH base AS (
  SELECT GREATEST(
    COALESCE((SELECT MAX(id) FROM public.${qtable}), 0),
    COALESCE((SELECT MAX(id) FROM _csv_stage), 0)
  ) AS lo
),
conflicts AS (
  SELECT s.ctid AS rid,
         base.lo + ROW_NUMBER() OVER (ORDER BY s.id)::integer AS new_id
  FROM _csv_stage s
  CROSS JOIN base
  WHERE EXISTS (SELECT 1 FROM public.${qtable} t WHERE t.id = s.id)
)
UPDATE _csv_stage s
SET id = c.new_id
FROM conflicts c
WHERE s.ctid = c.rid;

INSERT INTO public.${qtable} (${cols})
SELECT ${cols} FROM _csv_stage
ON CONFLICT DO NOTHING;

DROP TABLE IF EXISTS _csv_stage;
SQL
    return
  fi

  if [[ "$VIDEO_ASSOC_TABLES" == *"|${table}|"* ]]; then
    "${PSQL[@]}" -v ON_ERROR_STOP=1 <<SQL
DROP TABLE IF EXISTS _csv_stage;
CREATE TEMP TABLE _csv_stage (LIKE public.${qtable} INCLUDING DEFAULTS);
\copy _csv_stage (${cols}) FROM '${file}' WITH (FORMAT csv, HEADER true)

DELETE FROM _csv_stage s
WHERE EXISTS (
  SELECT 1 FROM public._import_video_id_skip k WHERE k.old_id = s.video_id
);

UPDATE _csv_stage s
SET video_id = m.new_id
FROM public._import_video_id_map m
WHERE s.video_id = m.old_id;

INSERT INTO public.${qtable} (${cols})
SELECT ${cols} FROM _csv_stage
ON CONFLICT DO NOTHING;

DROP TABLE IF EXISTS _csv_stage;
SQL
    return
  fi

  "${PSQL[@]}" -v ON_ERROR_STOP=1 <<SQL
DROP TABLE IF EXISTS _csv_stage;
CREATE TEMP TABLE _csv_stage (LIKE public.${qtable} INCLUDING DEFAULTS);
\copy _csv_stage (${cols}) FROM '${file}' WITH (FORMAT csv, HEADER true)
INSERT INTO public.${qtable} (${cols})
SELECT ${cols} FROM _csv_stage
ON CONFLICT DO NOTHING;
DROP TABLE IF EXISTS _csv_stage;
SQL
}

# COPY / INSERT with explicit ids does not advance serial/identity sequences.
# Bump every public sequence owned by a column to at least MAX(column).
resync_sequences() {
  echo "=== resync serial / identity sequences ==="
  "${PSQL[@]}" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  rec record;
  max_val bigint;
  seq_name text;
BEGIN
  FOR rec IN
    SELECT
      n.nspname AS schema_name,
      c.relname AS table_name,
      a.attname AS column_name,
      pg_get_serial_sequence(
        format('%I.%I', n.nspname, c.relname),
        a.attname
      ) AS seq
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND pg_get_serial_sequence(
        format('%I.%I', n.nspname, c.relname),
        a.attname
      ) IS NOT NULL
    ORDER BY c.relname, a.attnum
  LOOP
    seq_name := rec.seq;
    EXECUTE format(
      'SELECT COALESCE(MAX(%I), 0) FROM %I.%I',
      rec.column_name,
      rec.schema_name,
      rec.table_name
    ) INTO max_val;

    IF max_val < 1 THEN
      PERFORM setval(seq_name, 1, false);
      RAISE NOTICE 'sequence % -> 1 (empty %.%)',
        seq_name, rec.schema_name, rec.table_name;
    ELSE
      PERFORM setval(seq_name, max_val, true);
      RAISE NOTICE 'sequence % -> % (%.%.%)',
        seq_name, max_val, rec.schema_name, rec.table_name, rec.column_name;
    END IF;
  END LOOP;
END
$$;
SQL
}

echo "Import dir: $IMPORT_DIR"
echo "Tables:     ${#ORDER[@]}"
echo

if [[ "$TRUNCATE_BEFORE_IMPORT" == "true" ]]; then
  truncate_tables "${ORDER[@]}"
  echo
fi

drop_video_id_maps
ensure_video_id_maps

for table in "${ORDER[@]}"; do
  mapfile -t batches < <(list_batches "$table")
  if [[ ${#batches[@]} -eq 0 || -z "${batches[0]:-}" ]]; then
    echo "=== public.${table} (no CSV batches, skip) ==="
    continue
  fi

  echo "=== public.${table} (${#batches[@]} batch(es)) ==="
  for file in "${batches[@]}"; do
    [[ -n "$file" ]] || continue
    import_file "$table" "$file"
  done
done

echo
resync_sequences
drop_video_id_maps

echo
echo "Done."
