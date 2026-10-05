"""Unit tests for ``app.services.video_watch.WatchService``."""

# pylint: disable=unused-import, unused-argument

from __future__ import annotations

import uuid
from typing import Optional, cast
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import BackgroundTasks, HTTPException

from app.repositories.video import VideoRepository
from app.schemas.video_watch import HeartbeatRequest, PlayStartRequest
from app.services.video_watch import WatchService


class _FakeRedis:
    """Minimal async Redis stand-in for cooldown / session keys."""

    def __init__(self) -> None:
        self._store: dict[str, str] = {}

    async def set(
        self,
        key: str,
        value: str,
        *,
        nx: bool = False,
        ex: Optional[int] = None,
    ) -> Optional[bool]:
        if nx and key in self._store:
            return None

        self._store[key] = value

        return True

    async def get(self, key: str) -> Optional[str]:
        return self._store.get(key)

    async def exists(self, key: str) -> int:
        return 1 if key in self._store else 0


class _FakeVideoRepository:
    """Repository stub with exists_by_id and a session placeholder."""

    def __init__(self, *, exists: bool = True) -> None:
        self.exists = exists
        self.session = MagicMock()

    async def exists_by_id(self, video_id: int) -> bool:
        return self.exists


@pytest.mark.asyncio
async def test_start_play_raises_when_video_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Unknown video ids yield HTTP 404."""

    service = WatchService(
        repository=cast(VideoRepository, _FakeVideoRepository(exists=False))
    )
    redis = _FakeRedis()
    background_tasks = BackgroundTasks()

    with pytest.raises(HTTPException) as exc_info:
        await service.start_play(
            999,
            user_id=uuid.uuid4(),
            redis=redis,  # type: ignore[arg-type]
            background_tasks=background_tasks,
        )

    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_start_play_marks_first_session_eligible(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """First play within the cooldown window is eligible to count."""

    async def _noop_publish(_payload: dict) -> None:
        return None

    monkeypatch.setattr(
        "app.services.video_watch.publish_watch_message",
        _noop_publish,
    )

    async def _no_history(*_args, **_kwargs):
        return None

    monkeypatch.setattr(
        "app.services.video_watch.UserWatchHistory.get_for_user_video",
        _no_history,
    )

    service = WatchService(
        repository=cast(VideoRepository, _FakeVideoRepository(exists=True))
    )
    redis = _FakeRedis()
    background_tasks = BackgroundTasks()
    user_id = uuid.uuid4()

    result = await service.start_play(
        42,
        user_id=user_id,
        redis=redis,  # type: ignore[arg-type]
        background_tasks=background_tasks,
        position_seconds=12.0,
    )

    assert result.video_id == 42
    assert result.is_eligible is True
    assert result.position_seconds == 0.0
    assert result.total_view_count == 0
    assert result.playback_session_id is not None


@pytest.mark.asyncio
async def test_start_play_second_call_not_eligible(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A second start while the cooldown key exists is not eligible."""

    async def _noop_publish(_payload: dict) -> None:
        return None

    monkeypatch.setattr(
        "app.services.video_watch.publish_watch_message",
        _noop_publish,
    )

    async def _no_history(*_args, **_kwargs):
        return None

    monkeypatch.setattr(
        "app.services.video_watch.UserWatchHistory.get_for_user_video",
        _no_history,
    )

    service = WatchService(
        repository=cast(VideoRepository, _FakeVideoRepository(exists=True))
    )
    redis = _FakeRedis()
    background_tasks = BackgroundTasks()
    user_id = uuid.uuid4()

    first = await service.start_play(
        7,
        user_id=user_id,
        redis=redis,  # type: ignore[arg-type]
        background_tasks=background_tasks,
    )
    second = await service.start_play(
        7,
        user_id=user_id,
        redis=redis,  # type: ignore[arg-type]
        background_tasks=background_tasks,
    )

    assert first.is_eligible is True
    assert second.is_eligible is False


@pytest.mark.asyncio
async def test_heartbeat_raises_when_video_missing() -> None:
    """Heartbeat for a missing video yields HTTP 404."""

    service = WatchService(
        repository=cast(VideoRepository, _FakeVideoRepository(exists=False))
    )
    redis = _FakeRedis()
    background_tasks = BackgroundTasks()

    with pytest.raises(HTTPException) as exc_info:
        await service.heartbeat(
            1,
            user_id=uuid.uuid4(),
            redis=redis,  # type: ignore[arg-type]
            background_tasks=background_tasks,
            playback_session_id=uuid.uuid4(),
            position_seconds=5.0,
        )

    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_heartbeat_accepts_position(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Heartbeat enqueues and returns the reported position."""

    async def _noop_publish(_payload: dict) -> None:
        return None

    monkeypatch.setattr(
        "app.services.video_watch.publish_watch_message",
        _noop_publish,
    )

    service = WatchService(
        repository=cast(VideoRepository, _FakeVideoRepository(exists=True))
    )
    redis = _FakeRedis()
    background_tasks = BackgroundTasks()
    session_id = uuid.uuid4()

    result = await service.heartbeat(
        3,
        user_id=uuid.uuid4(),
        redis=redis,  # type: ignore[arg-type]
        background_tasks=background_tasks,
        playback_session_id=session_id,
        position_seconds=40.0,
        watched_seconds_delta=10.0,
    )

    assert result.accepted is True
    assert result.video_id == 3
    assert result.position_seconds == 40.0
    assert result.playback_session_id == session_id


@pytest.mark.asyncio
async def test_get_progress_returns_zeros_when_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Progress defaults to zeros when the user has no history row."""

    async def _no_history(*_args, **_kwargs):
        return None

    monkeypatch.setattr(
        "app.services.video_watch.UserWatchHistory.get_for_user_video",
        _no_history,
    )

    service = WatchService(
        repository=cast(VideoRepository, _FakeVideoRepository(exists=True))
    )

    result = await service.get_progress(5, user_id=uuid.uuid4())

    assert result.video_id == 5
    assert result.position_seconds == 0.0
    assert result.watch_count == 0


@pytest.mark.asyncio
async def test_list_progress_returns_empty(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """List progress returns an empty page when the user has no history."""

    async def _empty_list(*_args, **_kwargs):
        return []

    monkeypatch.setattr(
        "app.services.video_watch.UserWatchHistory.list_for_user",
        _empty_list,
    )

    service = WatchService(
        repository=cast(VideoRepository, _FakeVideoRepository(exists=True))
    )

    result = await service.list_progress(
        user_id=uuid.uuid4(), limit=10, offset=0
    )

    assert result.items == []
    assert result.limit == 10
    assert result.offset == 0
