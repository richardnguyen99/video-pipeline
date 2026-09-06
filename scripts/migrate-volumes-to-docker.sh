#!/usr/bin/env bash
# Migrate Postgres / Redis / MinIO data from an external-drive bind path
# into Docker named volumes under Docker's native volume directory.
#
# Compose names volumes as {project}_{volume_key}. For this repo the
# defaults are:
#   video-pipeline_postgres18_data
#   video-pipeline_redis_data
#   video-pipeline_minio_data
#
# Usage:
#   ./scripts/migrate-volumes-to-docker.sh
#   ./scripts/migrate-volumes-to-docker.sh --dry-run
#   ./scripts/migrate-volumes-to-docker.sh --only redis
#   ./scripts/migrate-volumes-to-docker.sh --only postgres --only minio
#   ./scripts/migrate-volumes-to-docker.sh --only redis,minio --force
#   COMPOSE_PROJECT_NAME=video-pipeline ./scripts/migrate-volumes-to-docker.sh
#   POSTGRES_SRC=/path/to/postgres-data \
#   REDIS_SRC=/path/to/redis-data \
#   MINIO_SRC=/path/to/minio-data \
#     ./scripts/migrate-volumes-to-docker.sh
#
# Targets (with --only):
#   postgres | redis | minio
#   Omit --only to migrate all three.
#
# Defaults match a typical external-drive layout:
#   /run/media/$USER/Jav/{postgres-data,redis-data,minio-data}
# MinIO prefixes are copied as-is (e.g. actress-banner/, video-samples/).
#
# Safety:
#   - Stops only the targeted project containers before copying
#   - Never deletes or modifies the external-drive source
#   - Refuses to overwrite a non-empty destination volume unless --force
#   - Verifies basic presence of expected files after copy
#   - Does not auto-start services unless --start
#
# After a successful run:
#   1. Unset REDIS_DATA_DIR / MINIO_DATA_DIR / POSTGRES_DATA_DIR for the
#      services you migrated (or leave them empty)
#   2. Ensure docker-compose.minio.yml uses the named volume (see repo)
#   3. docker compose ... up -d for each migrated stack
#   4. Confirm health, then optionally archive/remove the external copies

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

DRY_RUN=0
FORCE=0
START_AFTER=0
ONLY_RAW=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --force)
      FORCE=1
      shift
      ;;
    --start)
      START_AFTER=1
      shift
      ;;
    --only)
      if [[ $# -lt 2 ]]; then
        echo "ERROR: --only requires a target (postgres|redis|minio)" >&2
        exit 1
      fi
      ONLY_RAW+=("$2")
      shift 2
      ;;
    --only=*)
      ONLY_RAW+=("${1#--only=}")
      shift
      ;;
    -h | --help)
      sed -n '2,50p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

USER_NAME="$(id -un)"
DEFAULT_BASE="/run/media/${USER_NAME}/Jav"

# Compose project name prefixes local volumes: {project}_{volume_key}.
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-$(basename "$ROOT_DIR")}"

POSTGRES_SRC="${POSTGRES_SRC:-${DEFAULT_BASE}/postgres-data}"
REDIS_SRC="${REDIS_SRC:-${DEFAULT_BASE}/redis-data}"
MINIO_SRC="${MINIO_SRC:-${DEFAULT_BASE}/minio-data}"

POSTGRES_VOLUME="${POSTGRES_VOLUME:-${COMPOSE_PROJECT_NAME}_postgres18_data}"
REDIS_VOLUME="${REDIS_VOLUME:-${COMPOSE_PROJECT_NAME}_redis_data}"
MINIO_VOLUME="${MINIO_VOLUME:-${COMPOSE_PROJECT_NAME}_minio_data}"

POSTGRES_COMPOSE="${POSTGRES_COMPOSE:-$ROOT_DIR/docker-compose.postgres.yml}"
REDIS_COMPOSE="${REDIS_COMPOSE:-$ROOT_DIR/docker-compose.redis.yml}"
MINIO_COMPOSE="${MINIO_COMPOSE:-$ROOT_DIR/docker-compose.minio.yml}"

POSTGRES_ENV="${POSTGRES_ENV:-$ROOT_DIR/.env.postgres}"
REDIS_ENV="${REDIS_ENV:-$ROOT_DIR/.env.redis}"
MINIO_ENV="${MINIO_ENV:-$ROOT_DIR/.env.minio}"

COPY_IMAGE="${COPY_IMAGE:-alpine:3.20}"

DO_POSTGRES=0
DO_REDIS=0
DO_MINIO=0

log() {
  printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$*"
}

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

normalize_target() {
  local t
  t="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  case "$t" in
    postgres | postgresql | pg) printf 'postgres\n' ;;
    redis) printf 'redis\n' ;;
    minio | s3) printf 'minio\n' ;;
    *) die "Unknown target: $1 (expected postgres, redis, or minio)" ;;
  esac
}

if [[ ${#ONLY_RAW[@]} -eq 0 ]]; then
  DO_POSTGRES=1
  DO_REDIS=1
  DO_MINIO=1
else
  for raw in "${ONLY_RAW[@]}"; do
    IFS=',' read -r -a parts <<<"$raw"
    for part in "${parts[@]}"; do
      part="$(printf '%s' "$part" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
      [[ -z "$part" ]] && continue
      case "$(normalize_target "$part")" in
        postgres) DO_POSTGRES=1 ;;
        redis) DO_REDIS=1 ;;
        minio) DO_MINIO=1 ;;
      esac
    done
  done
fi

TARGETS=()
[[ "$DO_POSTGRES" -eq 1 ]] && TARGETS+=("postgres")
[[ "$DO_REDIS" -eq 1 ]] && TARGETS+=("redis")
[[ "$DO_MINIO" -eq 1 ]] && TARGETS+=("minio")

require_cmd docker

if ! docker info >/dev/null 2>&1; then
  die "Docker daemon is not reachable. Start Docker and retry."
fi

if [[ "$DO_POSTGRES" -eq 1 ]]; then
  [[ -d "$POSTGRES_SRC" ]] || die "Postgres source not found: $POSTGRES_SRC"
fi

if [[ "$DO_REDIS" -eq 1 ]]; then
  [[ -d "$REDIS_SRC" ]] || die "Redis source not found: $REDIS_SRC"
fi

if [[ "$DO_MINIO" -eq 1 ]]; then
  [[ -d "$MINIO_SRC" ]] || die "MinIO source not found: $MINIO_SRC"
fi

log "Compose project: $COMPOSE_PROJECT_NAME"
log "Targets: ${TARGETS[*]}"
log "Source paths → Docker volumes:"
[[ "$DO_POSTGRES" -eq 1 ]] && log "  Postgres → $POSTGRES_SRC  →  $POSTGRES_VOLUME"
[[ "$DO_REDIS" -eq 1 ]] && log "  Redis    → $REDIS_SRC  →  $REDIS_VOLUME"
[[ "$DO_MINIO" -eq 1 ]] && log "  MinIO    → $MINIO_SRC  →  $MINIO_VOLUME"

if [[ "$DRY_RUN" -eq 1 ]]; then
  log "Dry-run mode: no containers will be stopped and no data will be written."
fi

compose_down() {
  local env_file="$1"
  local compose_file="$2"
  local name="$3"

  if [[ ! -f "$compose_file" ]]; then
    log "Skip stop $name: compose file missing ($compose_file)"
    return 0
  fi

  local args=(-p "$COMPOSE_PROJECT_NAME" -f "$compose_file")

  if [[ -f "$env_file" ]]; then
    args=(--env-file "$env_file" "${args[@]}")
  fi

  log "Stopping $name..."

  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "  dry-run: docker compose ${args[*]} stop"
    return 0
  fi

  docker compose "${args[@]}" stop 2>/dev/null || true
}

compose_up() {
  local env_file="$1"
  local compose_file="$2"
  local name="$3"

  if [[ ! -f "$compose_file" ]]; then
    log "Skip start $name: compose file missing ($compose_file)"
    return 0
  fi

  log "Starting $name..."

  if [[ -f "$env_file" ]]; then
    docker compose --env-file "$env_file" -p "$COMPOSE_PROJECT_NAME" -f "$compose_file" up -d
  else
    docker compose -p "$COMPOSE_PROJECT_NAME" -f "$compose_file" up -d
  fi
}

if [[ "$DO_POSTGRES" -eq 1 ]]; then
  compose_down "$POSTGRES_ENV" "$POSTGRES_COMPOSE" "postgres"
fi

if [[ "$DO_REDIS" -eq 1 ]]; then
  compose_down "$REDIS_ENV" "$REDIS_COMPOSE" "redis"
fi

if [[ "$DO_MINIO" -eq 1 ]]; then
  compose_down "$MINIO_ENV" "$MINIO_COMPOSE" "minio"
fi

if [[ "$DRY_RUN" -eq 0 ]]; then
  if [[ "$DO_POSTGRES" -eq 1 ]]; then
    if docker ps -aq --filter "name=^video-pipeline-postgres$" | grep -q .; then
      log "Force-stopping leftover container video-pipeline-postgres"
      docker stop video-pipeline-postgres >/dev/null 2>&1 || true
    fi
  fi

  if [[ "$DO_REDIS" -eq 1 ]]; then
    if docker ps -aq --filter "name=^video-pipeline-redis$" | grep -q .; then
      log "Force-stopping leftover container video-pipeline-redis"
      docker stop video-pipeline-redis >/dev/null 2>&1 || true
    fi
  fi

  if [[ "$DO_MINIO" -eq 1 ]]; then
    for c in video-pipeline-minio video-pipeline-minio-init; do
      if docker ps -aq --filter "name=^${c}$" | grep -q .; then
        log "Force-stopping leftover container $c"
        docker stop "$c" >/dev/null 2>&1 || true
      fi
    done
  fi
fi

volume_is_empty() {
  local vol="$1"
  local count

  count="$(
    docker run --rm -v "${vol}:/dest:ro" "$COPY_IMAGE" \
      sh -c 'find /dest -mindepth 1 | head -n 1 | wc -l' 2>/dev/null || echo 1
  )"

  [[ "${count// /}" == "0" ]]
}

ensure_volume() {
  local vol="$1"

  if docker volume inspect "$vol" >/dev/null 2>&1; then
    log "Volume exists: $vol"

    if ! volume_is_empty "$vol"; then
      if [[ "$FORCE" -eq 1 ]]; then
        log "  volume is non-empty; --force set, will overwrite contents"
      else
        die "Volume $vol is not empty. Re-run with --force to overwrite, or remove it first: docker volume rm $vol"
      fi
    fi
  else
    log "Creating volume: $vol"

    if [[ "$DRY_RUN" -eq 0 ]]; then
      docker volume create "$vol" >/dev/null
    fi
  fi
}

copy_into_volume() {
  local label="$1"
  local src="$2"
  local vol="$3"

  log "Copying $label → volume $vol"

  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "  dry-run: rsync -aH --delete $src/ → volume:$vol/"
    return 0
  fi

  docker pull -q "$COPY_IMAGE" >/dev/null 2>&1 || true

  docker run --rm \
    -v "${src}:/src:ro" \
    -v "${vol}:/dest" \
    "$COPY_IMAGE" \
    sh -c '
      set -e
      apk add --no-cache rsync >/dev/null
      mkdir -p /dest
      rsync -aH --delete /src/ /dest/
      echo "files=$(find /dest -type f | wc -l) dirs=$(find /dest -type d | wc -l)"
    '
}

verify_marker() {
  local label="$1"
  local vol="$2"
  local pattern="$3"

  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "  dry-run: skip verify $label ($pattern)"
    return 0
  fi

  if docker run --rm -v "${vol}:/dest:ro" "$COPY_IMAGE" \
    sh -c "find /dest -path '$pattern' | head -n 1 | grep -q ."; then
    log "Verified $label marker: $pattern"
  else
    die "Post-copy check failed for $label: expected path matching $pattern inside $vol"
  fi
}

if [[ "$DO_POSTGRES" -eq 1 ]]; then
  ensure_volume "$POSTGRES_VOLUME"
  copy_into_volume "Postgres" "$POSTGRES_SRC" "$POSTGRES_VOLUME"
  verify_marker "Postgres" "$POSTGRES_VOLUME" "/dest/18/*"
fi

if [[ "$DO_REDIS" -eq 1 ]]; then
  ensure_volume "$REDIS_VOLUME"
  copy_into_volume "Redis" "$REDIS_SRC" "$REDIS_VOLUME"
  verify_marker "Redis" "$REDIS_VOLUME" "/dest/dump.rdb"
fi

if [[ "$DO_MINIO" -eq 1 ]]; then
  ensure_volume "$MINIO_VOLUME"
  copy_into_volume "MinIO" "$MINIO_SRC" "$MINIO_VOLUME"
  verify_marker "MinIO" "$MINIO_VOLUME" "/dest/video-samples/*"
  verify_marker "MinIO" "$MINIO_VOLUME" "/dest/actress-banner/*"
fi

log "Migration copy finished for: ${TARGETS[*]}. External sources were left untouched."
log ""
log "Next steps (only for migrated targets):"

if [[ "$DO_REDIS" -eq 1 ]]; then
  log "  • .env.redis   → comment out or remove REDIS_DATA_DIR"
fi

if [[ "$DO_MINIO" -eq 1 ]]; then
  log "  • .env.minio   → comment out or remove MINIO_DATA_DIR"
  log "  • docker-compose.minio.yml should use named volume minio_data when unset"
fi

if [[ "$DO_POSTGRES" -eq 1 ]]; then
  log "  • .env.postgres → leave POSTGRES_DATA_DIR unset (compose uses named volume)"
fi

log "  Start stacks (project=$COMPOSE_PROJECT_NAME):"
[[ "$DO_POSTGRES" -eq 1 ]] && log "    docker compose -p $COMPOSE_PROJECT_NAME --env-file .env.postgres -f docker-compose.postgres.yml up -d"
[[ "$DO_REDIS" -eq 1 ]] && log "    docker compose -p $COMPOSE_PROJECT_NAME --env-file .env.redis -f docker-compose.redis.yml up -d"
[[ "$DO_MINIO" -eq 1 ]] && log "    docker compose -p $COMPOSE_PROJECT_NAME --env-file .env.minio -f docker-compose.minio.yml up -d"
log "  After health checks pass, archive or delete the external copies if desired."

if [[ "$START_AFTER" -eq 1 && "$DRY_RUN" -eq 0 ]]; then
  log "Starting selected services (--start)..."

  if [[ "$DO_POSTGRES" -eq 1 ]]; then
    compose_up "$POSTGRES_ENV" "$POSTGRES_COMPOSE" "postgres"
  fi

  if [[ "$DO_REDIS" -eq 1 ]]; then
    compose_up "$REDIS_ENV" "$REDIS_COMPOSE" "redis"
  fi

  if [[ "$DO_MINIO" -eq 1 ]]; then
    compose_up "$MINIO_ENV" "$MINIO_COMPOSE" "minio"
  fi
fi

log "Done."
