"""Stream processing for watch heartbeats (archive + tier-2 count)."""

from __future__ import annotations

import logging
import uuid
from typing import Any, Optional

from app.config import settings
from app.database import async_session_factory
from app.messaging.redis_client import get_redis_client
from app.messaging.watch_event_archive import buffer_watch_event
from app.models.user_watch_history import UserWatchHistory

_logger = logging.getLogger("uvicorn.error")

_SESSION_SECONDS_KEY = "watch:session:{session_id}:seconds"
_SESSION_COUNTED_KEY = "watch:session:{session_id}:counted"
_COOLDOWN_KEY = "watch:cooldown:{user_id}:{video_id}"


def _session_ttl_seconds() -> int:
    """TTL for per-session Redis keys used by the watch pipeline."""

    cooldown_seconds = max(0, int(settings.watch_cooldown_seconds))

    if cooldown_seconds > 0:
        return cooldown_seconds * 2

    heartbeat_seconds = max(1, int(settings.watch_heartbeat_interval_seconds))

    return max(heartbeat_seconds * 12, 120)


def _parse_uuid(value: object) -> Optional[uuid.UUID]:
    if value is None:
        return None

    try:
        return uuid.UUID(str(value))
    except ValueError, TypeError:
        return None


async def process_watch_message(payload: dict[str, Any]) -> None:
    """Handle one queue message; update history after threshold.

    Steps:
    1. Buffer the raw event in-memory for periodic archive upload.
    2. Accumulate watched seconds for the playback session in Redis.
    3. Upsert ``user_watch_history`` seek state on each event.
    4. When cumulative seconds >= threshold and ``is_eligible``, increment
       ``user_watch_history.total_view_count`` once per session.
    """

    event_type = str(payload.get("event_type") or "heartbeat")
    video_id = int(payload["video_id"])
    position_seconds = float(payload.get("position_seconds") or 0.0)
    is_eligible = bool(payload.get("is_eligible"))
    delta = float(payload.get("watched_seconds_delta") or 0.0)
    session_id = _parse_uuid(payload.get("playback_session_id"))
    user_id = _parse_uuid(payload.get("user_id"))

    if session_id is None:
        _logger.warning(
            "watch message missing playback_session_id: %s", payload
        )

        return

    await buffer_watch_event(payload)

    redis = await get_redis_client()
    seconds_key = _SESSION_SECONDS_KEY.format(session_id=session_id)
    counted_key = _SESSION_COUNTED_KEY.format(session_id=session_id)

    if delta > 0:
        total = await redis.incrbyfloat(seconds_key, delta)
        await redis.expire(seconds_key, _session_ttl_seconds())
    else:
        raw = await redis.get(seconds_key)
        total = float(raw) if raw is not None else 0.0

    # play_start often arrives with position_seconds=0 from the client.
    # Never overwrite the saved seek position on session open — only
    # heartbeats (and positive positions) may update resume state.
    should_update_position = event_type != "play_start" and (
        position_seconds > 0 or event_type == "heartbeat"
    )

    if user_id is not None and should_update_position:
        async with async_session_factory() as session:
            await UserWatchHistory.upsert(
                session,
                user_id=user_id,
                video_id=video_id,
                position_seconds=position_seconds,
                increment_view=False,
            )

    if not is_eligible:
        return

    if total < settings.watch_eligible_threshold_seconds:
        return

    already = await redis.get(counted_key)

    if already is not None:
        return

    cooldown_seconds = max(0, int(settings.watch_cooldown_seconds))

    if user_id is not None and cooldown_seconds > 0:
        cooldown_key = _COOLDOWN_KEY.format(
            user_id=user_id,
            video_id=video_id,
        )
        cooldown_acquired = await redis.set(
            cooldown_key,
            "1",
            nx=True,
            ex=cooldown_seconds,
        )

        if not cooldown_acquired:
            await redis.set(
                counted_key,
                "1",
                ex=_session_ttl_seconds(),
            )

            return

    await redis.set(
        counted_key,
        "1",
        ex=_session_ttl_seconds(),
    )

    if user_id is None:
        return

    async with async_session_factory() as session:
        await UserWatchHistory.upsert(
            session,
            user_id=user_id,
            video_id=video_id,
            position_seconds=position_seconds,
            increment_view=True,
        )

    _logger.info(
        "Eligible view counted video_id=%s user_id=%s session=%s total_s=%.1f",
        video_id,
        user_id,
        session_id,
        total,
    )
