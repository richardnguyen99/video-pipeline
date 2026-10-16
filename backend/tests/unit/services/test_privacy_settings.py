"""Unit tests for ``app.services.privacy_settings``."""

# pylint: disable=unused-argument

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional, cast
from uuid import UUID, uuid4

import pytest

from app.models.user_privacy_settings import UserPrivacySettings
from app.schemas.privacy_settings import PrivacySettingsUpdateRequest
from app.services.privacy_settings import PrivacySettingsService


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class _SessionSpy:
    """Session stand-in that records add / commit / refresh."""

    def __init__(self) -> None:
        self.added: list[Any] = []
        self.committed = 0
        self.refreshed: list[Any] = []

    def add(self, obj: Any) -> None:
        self.added.append(obj)

    async def commit(self) -> None:
        self.committed += 1

    async def refresh(self, obj: Any) -> None:
        self.refreshed.append(obj)


def _settings(
    *,
    user_id: UUID,
    show_watched_videos: bool = False,
    show_liked_videos: bool = False,
    show_subscriptions: bool = True,
    show_comment_history: bool = True,
) -> UserPrivacySettings:
    return UserPrivacySettings(
        id=uuid4(),
        user_id=user_id,
        show_watched_videos=show_watched_videos,
        show_liked_videos=show_liked_videos,
        show_subscriptions=show_subscriptions,
        show_comment_history=show_comment_history,
        created_at=_now(),
        updated_at=_now(),
    )


@pytest.mark.asyncio
async def test_get_settings_returns_defaults_when_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Unset users receive default privacy preferences."""

    session = _SessionSpy()

    async def _get_by_user_id(
        _session: object,
        *,
        user_id: UUID,
    ) -> Optional[UserPrivacySettings]:
        return None

    monkeypatch.setattr(
        UserPrivacySettings,
        "get_by_user_id",
        _get_by_user_id,
    )

    service = PrivacySettingsService(session=cast(Any, session))
    result = await service.get_settings(user_id=uuid4())

    assert result.id is None
    assert result.show_watched_videos is False
    assert result.show_liked_videos is False
    assert result.show_subscriptions is True
    assert result.show_comment_history is True


@pytest.mark.asyncio
async def test_get_settings_returns_existing_row(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Existing settings are mapped into the response schema."""

    user_id = uuid4()
    row = _settings(
        user_id=user_id,
        show_watched_videos=True,
        show_subscriptions=False,
    )
    session = _SessionSpy()

    async def _get_by_user_id(
        _session: object,
        *,
        user_id: UUID,
    ) -> Optional[UserPrivacySettings]:
        return row

    monkeypatch.setattr(
        UserPrivacySettings,
        "get_by_user_id",
        _get_by_user_id,
    )

    service = PrivacySettingsService(session=cast(Any, session))
    result = await service.get_settings(user_id=user_id)

    assert result.id == row.id
    assert result.show_watched_videos is True
    assert result.show_subscriptions is False


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
    ) -> Optional[UserPrivacySettings]:
        return None

    monkeypatch.setattr(
        UserPrivacySettings,
        "get_by_user_id",
        _get_by_user_id,
    )

    service = PrivacySettingsService(session=cast(Any, session))
    payload = PrivacySettingsUpdateRequest(
        show_watched_videos=True,
        show_liked_videos=True,
        show_subscriptions=False,
        show_comment_history=False,
    )
    result = await service.update_settings(user_id=user_id, payload=payload)

    assert result.show_watched_videos is True
    assert result.show_liked_videos is True
    assert result.show_subscriptions is False
    assert result.show_comment_history is False
    assert len(session.added) == 1
    assert session.committed == 1
    assert session.refreshed == session.added


@pytest.mark.asyncio
async def test_update_settings_replaces_existing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Update overwrites fields on an existing settings row."""

    user_id = uuid4()
    existing = _settings(user_id=user_id)
    session = _SessionSpy()

    async def _get_by_user_id(
        _session: object,
        *,
        user_id: UUID,
    ) -> Optional[UserPrivacySettings]:
        return existing

    monkeypatch.setattr(
        UserPrivacySettings,
        "get_by_user_id",
        _get_by_user_id,
    )

    service = PrivacySettingsService(session=cast(Any, session))
    payload = PrivacySettingsUpdateRequest(
        show_watched_videos=True,
        show_liked_videos=False,
        show_subscriptions=False,
        show_comment_history=True,
    )
    result = await service.update_settings(user_id=user_id, payload=payload)

    assert result.show_watched_videos is True
    assert existing.show_watched_videos is True
    assert existing.show_subscriptions is False
    assert session.committed == 1
    assert existing in session.added
