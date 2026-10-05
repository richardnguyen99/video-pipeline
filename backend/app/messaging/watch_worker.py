"""Stream processing for watch heartbeats (tier-1 log + tier-2 count)."""

from __future__ import annotations

import logging
import uuid
from typing import Any, Optional

from app.config import settings
from app.database import async_session_factory
from app.messaging.redis_client import get_redis_client
from app.models.user_watch_history import UserWatchHistory
from app.models.video_view import VideoView
from app.models.watch_event import WatchEvent

_logger = logging.getLogger("uvicorn.error")

_SESSION_SECONDS_KEY = "watch:session:{session_id}:seconds"
_SESSION_COUNTED_KEY = "watch:session:{session_id}:counted"


def _parse_uuid(value: object) -> Optional[uuid.UUID]:
    if value is None:
        return None

    try:
        return uuid.UUID(str(value))
    except ValueError, TypeError:
        return None


async def process_watch_message(payload: dict[str, Any]) -> None:
    """Handle one queue message: always log; count view when eligible.

    Steps:
    1. Append a ``watch_event`` row (tier 1, never updated).
    2. Accumulate watched seconds for the playback session in Redis.
    3. When cumulative seconds >= threshold and ``is_eligible``, insert a
       ``video_view`` (global counter) and upsert ``user_watch_history``.
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

    async with async_session_factory() as session:
        event = WatchEvent.create(
            playback_session_id=session_id,
            video_id=video_id,
            event_type=event_type,
            position_seconds=position_seconds,
            user_id=user_id,
            is_eligible=is_eligible,
        )
        session.add(event)
        await session.commit()

    redis = await get_redis_client()
    seconds_key = _SESSION_SECONDS_KEY.format(session_id=session_id)
    counted_key = _SESSION_COUNTED_KEY.format(session_id=session_id)

    if delta > 0:
        total = await redis.incrbyfloat(seconds_key, delta)
        await redis.expire(seconds_key, settings.watch_cooldown_seconds * 2)
    else:
        raw = await redis.get(seconds_key)
        total = float(raw) if raw is not None else 0.0

    if user_id is not None:
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

    await redis.set(
        counted_key,
        "1",
        ex=settings.watch_cooldown_seconds * 2,
    )

    async with async_session_factory() as session:
        view = VideoView.create(video_id=video_id, user_id=user_id)
        session.add(view)
        await session.commit()

        if user_id is not None:
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
