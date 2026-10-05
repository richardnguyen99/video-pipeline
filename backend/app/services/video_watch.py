"""Playback session orchestration (cooldown, queue publish, progress)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import BackgroundTasks, HTTPException, status
from redis.asyncio import Redis

from app.config import settings
from app.messaging.rabbitmq import publish_watch_message
from app.models.user_watch_history import UserWatchHistory
from app.repositories.video import VideoRepository
from app.schemas.video_watch import (
    HeartbeatResponse,
    PlayStartResponse,
    VideoWatchProgressListResponse,
    VideoWatchProgressResponse,
)

_COOLDOWN_KEY = "watch:cooldown:{user_id}:{video_id}"


class WatchService:
    """Start play sessions, accept heartbeats, and expose progress."""

    def __init__(self, repository: VideoRepository) -> None:
        self._repository = repository

    async def start_play(
        self,
        video_id: int,
        *,
        user_id: uuid.UUID,
        redis: Redis,
        background_tasks: BackgroundTasks,
        playback_session_id: Optional[uuid.UUID] = None,
        position_seconds: float = 0.0,
    ) -> PlayStartResponse:
        """Start a playback session with Redis cooldown eligibility.

        When the cooldown key is missing, the watch is eligible to count and
        a 30-minute TTL key is set. A play_start message is published to the
        watch queue via a FastAPI background task.
        """

        if not await self._repository.exists_by_id(video_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Video not found",
            )

        session_id = playback_session_id or uuid.uuid4()
        cooldown_key = _COOLDOWN_KEY.format(
            user_id=user_id,
            video_id=video_id,
        )
        was_set = await redis.set(
            cooldown_key,
            "1",
            nx=True,
            ex=settings.watch_cooldown_seconds,
        )
        is_eligible = bool(was_set)
        await redis.set(
            f"watch:session:{session_id}:eligible",
            "1" if is_eligible else "0",
            ex=settings.watch_cooldown_seconds * 2,
        )

        payload = {
            "event_type": "play_start",
            "playback_session_id": str(session_id),
            "user_id": str(user_id),
            "video_id": video_id,
            "position_seconds": max(0.0, float(position_seconds)),
            "is_eligible": is_eligible,
            "watched_seconds_delta": 0.0,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        background_tasks.add_task(publish_watch_message, payload)

        history = await UserWatchHistory.get_for_user_video(
            self._repository.session,
            user_id=user_id,
            video_id=video_id,
        )

        return PlayStartResponse(
            playback_session_id=session_id,
            video_id=video_id,
            is_eligible=is_eligible,
            position_seconds=(
                history.position_seconds if history is not None else 0.0
            ),
            total_view_count=(
                history.total_view_count if history is not None else 0
            ),
            cooldown_seconds=settings.watch_cooldown_seconds,
            heartbeat_interval_seconds=settings.watch_heartbeat_interval_seconds,
            eligible_threshold_seconds=settings.watch_eligible_threshold_seconds,
        )

    async def heartbeat(
        self,
        video_id: int,
        *,
        user_id: uuid.UUID,
        redis: Redis,
        background_tasks: BackgroundTasks,
        playback_session_id: uuid.UUID,
        position_seconds: float,
        watched_seconds_delta: Optional[float] = None,
    ) -> HeartbeatResponse:
        """Accept a ~10s heartbeat and enqueue it for aggregation."""

        if not await self._repository.exists_by_id(video_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Video not found",
            )

        eligible_raw = await redis.get(
            f"watch:session:{playback_session_id}:eligible"
        )
        is_eligible = eligible_raw == "1"
        delta = (
            float(watched_seconds_delta)
            if watched_seconds_delta is not None
            else float(settings.watch_heartbeat_interval_seconds)
        )

        payload = {
            "event_type": "heartbeat",
            "playback_session_id": str(playback_session_id),
            "user_id": str(user_id),
            "video_id": video_id,
            "position_seconds": max(0.0, float(position_seconds)),
            "is_eligible": is_eligible,
            "watched_seconds_delta": max(0.0, delta),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        background_tasks.add_task(publish_watch_message, payload)

        return HeartbeatResponse(
            playback_session_id=playback_session_id,
            video_id=video_id,
            position_seconds=max(0.0, float(position_seconds)),
            accepted=True,
        )

    async def get_progress(
        self,
        video_id: int,
        *,
        user_id: uuid.UUID,
    ) -> VideoWatchProgressResponse:
        """Return resume position and view count for the user."""

        if not await self._repository.exists_by_id(video_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Video not found",
            )

        history = await UserWatchHistory.get_for_user_video(
            self._repository.session,
            user_id=user_id,
            video_id=video_id,
        )

        if history is None:
            return VideoWatchProgressResponse(
                video_id=video_id,
                position_seconds=0.0,
                watch_count=0,
                last_watched_at=None,
                updated_at=None,
            )

        return VideoWatchProgressResponse(
            video_id=history.video_id,
            position_seconds=history.position_seconds,
            watch_count=history.total_view_count,
            last_watched_at=history.last_watched_at,
            updated_at=history.updated_at,
        )

    async def list_progress(
        self,
        *,
        user_id: uuid.UUID,
        limit: int = 20,
        offset: int = 0,
    ) -> VideoWatchProgressListResponse:
        """List the user's watch history newest first."""

        safe_limit = max(1, min(limit, 100))
        safe_offset = max(0, offset)
        items = await UserWatchHistory.list_for_user(
            self._repository.session,
            user_id=user_id,
            limit=safe_limit,
            offset=safe_offset,
        )

        return VideoWatchProgressListResponse(
            items=[
                VideoWatchProgressResponse(
                    video_id=row.video_id,
                    position_seconds=row.position_seconds,
                    watch_count=row.total_view_count,
                    last_watched_at=row.last_watched_at,
                    updated_at=row.updated_at,
                )
                for row in items
            ],
            total=len(items),
            limit=safe_limit,
            offset=safe_offset,
        )
