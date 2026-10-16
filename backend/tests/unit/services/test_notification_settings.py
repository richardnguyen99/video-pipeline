"""Unit tests for ``app.services.notification_settings``."""

# pylint: disable=unused-argument

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional, cast
from uuid import UUID, uuid4

import pytest

from app.models.user_notification_settings import UserNotificationSettings
from app.schemas.notification_settings import (
    NotificationSettingsUpdateRequest,
)
from app.services.notification_settings import NotificationSettingsService


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class _SessionSpy:
    """Session stand-in that records add / commit / refresh."""

    def __init__(self) -> None:
        self.added: list[Any] = []
        self.committed = 0
        self.refreshed: list[Any] = []
        self.exec_results: list[Any] = []

    def add(self, obj: Any) -> None:
        self.added.append(obj)

    async def commit(self) -> None:
        self.committed += 1

    async def refresh(self, obj: Any) -> None:
        self.refreshed.append(obj)

    async def exec(self, _statement: object) -> Any:
        first_value: Any = None

        if self.exec_results:
            first_value = self.exec_results.pop(0)

        class _ExecResult:
            def first(self) -> Any:
                return first_value

        return _ExecResult()


def _settings(
    *,
    user_id: UUID,
    preferred_language: str = "en",
    notify_followed_videos: bool = True,
    notify_public_video_activity: bool = True,
    notify_public_playlist_activity: bool = False,
    notify_comment_replies: bool = True,
) -> UserNotificationSettings:
    return UserNotificationSettings(
        id=uuid4(),
        user_id=user_id,
        preferred_language=preferred_language,
        notify_followed_videos=notify_followed_videos,
        notify_public_video_activity=notify_public_video_activity,
        notify_public_playlist_activity=notify_public_playlist_activity,
        notify_comment_replies=notify_comment_replies,
        created_at=_now(),
        updated_at=_now(),
    )


@pytest.mark.asyncio
async def test_get_settings_returns_defaults_when_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Unset users receive default notification preferences."""

    session = _SessionSpy()

    async def _get_by_user_id(
        _session: object,
        *,
        user_id: UUID,
    ) -> Optional[UserNotificationSettings]:
        return None

    monkeypatch.setattr(
        UserNotificationSettings,
        "get_by_user_id",
        _get_by_user_id,
    )

    service = NotificationSettingsService(session=cast(Any, session))
    result = await service.get_settings(user_id=uuid4())

    assert result.id is None
    assert result.preferred_language == "en"
    assert result.notify_followed_videos is True
    assert result.notify_public_video_activity is True
    assert result.notify_public_playlist_activity is True
    assert result.notify_comment_replies is True


@pytest.mark.asyncio
async def test_get_settings_returns_existing_row(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Existing settings are mapped into the response schema."""

    user_id = uuid4()
    row = _settings(user_id=user_id, preferred_language="ja")
    session = _SessionSpy()

    async def _get_by_user_id(
        _session: object,
        *,
        user_id: UUID,
    ) -> Optional[UserNotificationSettings]:
        return row

    monkeypatch.setattr(
        UserNotificationSettings,
        "get_by_user_id",
        _get_by_user_id,
    )

    service = NotificationSettingsService(session=cast(Any, session))
    result = await service.get_settings(user_id=user_id)

    assert result.id == row.id
    assert result.preferred_language == "ja"
    assert result.notify_public_playlist_activity is False


@pytest.mark.asyncio
async def test_update_settings_creates_row(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Update creates a new row when none exists."""

    user_id = uuid4()
    session = _SessionSpy()

    async def _get_by_user_id(
        _session: object,
        *,
        user_id: UUID,
    ) -> Optional[UserNotificationSettings]:
        return None

    monkeypatch.setattr(
        UserNotificationSettings,
        "get_by_user_id",
        _get_by_user_id,
    )

    service = NotificationSettingsService(session=cast(Any, session))
    payload = NotificationSettingsUpdateRequest(
        preferred_language="es",
        notify_followed_videos=False,
        notify_public_video_activity=True,
        notify_public_playlist_activity=False,
        notify_comment_replies=True,
    )
    result = await service.update_settings(user_id=user_id, payload=payload)

    assert result.preferred_language == "es"
    assert result.notify_followed_videos is False
    assert result.notify_public_playlist_activity is False
    assert len(session.added) == 1
    assert session.committed == 1
    assert session.refreshed == session.added


@pytest.mark.asyncio
async def test_update_settings_replaces_existing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Update overwrites fields on an existing settings row."""

    user_id = uuid4()
    existing = _settings(user_id=user_id, preferred_language="en")
    session = _SessionSpy()

    async def _get_by_user_id(
        _session: object,
        *,
        user_id: UUID,
    ) -> Optional[UserNotificationSettings]:
        return existing

    monkeypatch.setattr(
        UserNotificationSettings,
        "get_by_user_id",
        _get_by_user_id,
    )

    service = NotificationSettingsService(session=cast(Any, session))
    payload = NotificationSettingsUpdateRequest(
        preferred_language="de",
        notify_followed_videos=True,
        notify_public_video_activity=False,
        notify_public_playlist_activity=True,
        notify_comment_replies=False,
    )
    result = await service.update_settings(user_id=user_id, payload=payload)

    assert result.preferred_language == "de"
    assert existing.preferred_language == "de"
    assert existing.notify_public_video_activity is False
    assert existing.notify_comment_replies is False
    assert session.committed == 1
    assert existing in session.added
