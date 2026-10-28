"""Job locks and stuck-encode recovery for the transcode pipeline."""

# pylint: disable=broad-exception-caught

from __future__ import annotations

import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Optional

from app.messaging.redis_client import get_redis_client
from app.messaging.transcode_progress import (
    TranscodeProgressSnapshot,
    get_progress_snapshot,
)

_logger = logging.getLogger("uvicorn.error")

_JOB_LOCK_KEY = "transcode:lock:{public_id}"
_JOB_LOCK_TTL_S = 900
_JOB_LOCK_STALE_S = 180
_RECOVERY_DEBOUNCE_KEY = "transcode:recover:{public_id}"
_RECOVERY_DEBOUNCE_S = 60
_PROGRESS_STALE_S = 120

_STATUS_UPLOADED = "UPLOADED"
_STATUS_PROBING = "PROBING"
_STATUS_QUEUED = "QUEUED"
_STATUS_ENCODING = "ENCODING"
_STATUS_PACKAGING = "PACKAGING"

_RECOVERY_STATUSES = frozenset(
    {
        _STATUS_UPLOADED,
        _STATUS_PROBING,
        _STATUS_QUEUED,
        _STATUS_ENCODING,
        _STATUS_PACKAGING,
    },
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def progress_age_seconds(
    snapshot: Optional[TranscodeProgressSnapshot],
) -> Optional[float]:
    """Seconds since the last progress write, or None when unknown."""

    if snapshot is None or not snapshot.updated_at:
        return None

    try:
        updated = datetime.fromisoformat(snapshot.updated_at)

        if updated.tzinfo is not None:
            updated = updated.astimezone(timezone.utc).replace(tzinfo=None)

        return max(0.0, (_utcnow() - updated).total_seconds())
    except ValueError:
        return None


async def try_acquire_job_lock(public_id: uuid.UUID) -> bool:
    """Return True if this runner should process the job (Redis NX lock).

    Stale locks (no progress for ``_JOB_LOCK_STALE_S``) are stolen so a
    crashed ffmpeg/worker cannot leave the ladder stuck in ENCODING forever.
    """

    try:
        redis = await get_redis_client()
        key = _JOB_LOCK_KEY.format(public_id=public_id)
        token = f"{time.time():.3f}"
        acquired = await redis.set(key, token, nx=True, ex=_JOB_LOCK_TTL_S)

        if acquired:
            return True

        progress = await get_progress_snapshot(public_id)
        age = progress_age_seconds(progress)

        if age is not None and age < _JOB_LOCK_STALE_S:
            return False

        _logger.warning(
            "transcode: stealing stale job lock public_id=%s progress_age=%s",
            public_id,
            age,
        )
        await redis.delete(key)
        stolen = await redis.set(key, token, nx=True, ex=_JOB_LOCK_TTL_S)

        return bool(stolen)
    except Exception:
        _logger.debug(
            "transcode job lock unavailable; allowing run", exc_info=True
        )

        return True


async def refresh_job_lock(public_id: uuid.UUID) -> None:
    """Extend the job lock while encode progress is still advancing."""

    try:
        redis = await get_redis_client()
        await redis.expire(
            _JOB_LOCK_KEY.format(public_id=public_id),
            _JOB_LOCK_TTL_S,
        )
    except Exception:
        _logger.debug("transcode job lock refresh failed", exc_info=True)


async def release_job_lock(public_id: uuid.UUID) -> None:
    try:
        redis = await get_redis_client()
        await redis.delete(_JOB_LOCK_KEY.format(public_id=public_id))
    except Exception:
        _logger.debug("transcode job lock release failed", exc_info=True)


async def _try_recovery_debounce(public_id: uuid.UUID) -> bool:
    """Return True once per debounce window so recovery is not spammed."""

    try:
        redis = await get_redis_client()
        key = _RECOVERY_DEBOUNCE_KEY.format(public_id=public_id)
        acquired = await redis.set(key, "1", nx=True, ex=_RECOVERY_DEBOUNCE_S)

        return bool(acquired)
    except Exception:
        return True


async def maybe_recover_stuck_transcode(
    *,
    public_id: uuid.UUID,
    status: str,
    has_incomplete_rungs: bool,
) -> bool:
    """Return True when the caller should re-queue a stuck encode job.

    Debounced and progress-aware. Does not publish — the caller owns the
    re-queue to avoid import cycles with the RabbitMQ client.
    """

    normalized = (status or "").upper()

    if normalized not in _RECOVERY_STATUSES:
        return False

    if not has_incomplete_rungs and normalized != _STATUS_UPLOADED:
        return False

    live = await get_progress_snapshot(public_id)
    age = progress_age_seconds(live)

    if live is not None and age is not None and age < _PROGRESS_STALE_S:
        return False

    if not await _try_recovery_debounce(public_id):
        return False

    _logger.warning(
        "transcode: recovering stuck job public_id=%s status=%s progress_age=%s",
        public_id,
        normalized,
        age,
    )

    return True
