"""Unit tests for ``app.models.user_activity.UserActivity``."""

from __future__ import annotations

import uuid
from typing import Any

import pytest

from app.models.user_activity import UserActivity, UserActivityType


class _SessionSpy:
    """Minimal async session for record() tests."""

    def __init__(self) -> None:
        self.added: list[Any] = []
        self.flushed = 0
        self.committed = 0
        self.refreshed: list[Any] = []

    def add(self, obj: Any) -> None:
        self.added.append(obj)

    async def flush(self) -> None:
        self.flushed += 1

    async def commit(self) -> None:
        self.committed += 1

    async def refresh(self, obj: Any) -> None:
        self.refreshed.append(obj)


@pytest.mark.asyncio
async def test_record_without_commit_flushes() -> None:
    """record() adds a row and flushes when commit is False."""

    session = _SessionSpy()
    user_id = uuid.uuid4()

    row = await UserActivity.record(
        session,  # type: ignore[arg-type]
        user_id=user_id,
        event_type=UserActivityType.LOGIN,
        ip_address="10.0.0.1",
        user_agent="Firefox",
        commit=False,
    )

    assert row.user_id == user_id
    assert row.event_type == UserActivityType.LOGIN.value
    assert row.ip_address == "10.0.0.1"
    assert row.user_agent == "Firefox"
    assert session.added == [row]
    assert session.flushed == 1
    assert session.committed == 0


@pytest.mark.asyncio
async def test_record_with_commit_commits_and_refreshes() -> None:
    """record(commit=True) commits and refreshes the row."""

    session = _SessionSpy()
    user_id = uuid.uuid4()

    row = await UserActivity.record(
        session,  # type: ignore[arg-type]
        user_id=user_id,
        event_type="password_change",
        metadata={"source": "link"},
        commit=True,
    )

    assert row.event_type == UserActivityType.PASSWORD_CHANGE.value
    assert row.metadata_ == {"source": "link"}
    assert session.committed == 1
    assert session.refreshed == [row]
    assert session.flushed == 0


@pytest.mark.asyncio
async def test_record_truncates_long_user_agent() -> None:
    """User-agent strings longer than 255 characters are truncated."""

    session = _SessionSpy()
    long_ua = "x" * 300

    row = await UserActivity.record(
        session,  # type: ignore[arg-type]
        user_id=uuid.uuid4(),
        event_type=UserActivityType.LOGIN,
        user_agent=long_ua,
        commit=False,
    )

    assert row.user_agent is not None
    assert len(row.user_agent) == 255


@pytest.mark.asyncio
async def test_record_accepts_string_event_type() -> None:
    """String event_type values are stored as-is."""

    session = _SessionSpy()

    row = await UserActivity.record(
        session,  # type: ignore[arg-type]
        user_id=uuid.uuid4(),
        event_type="comment",
        metadata={"video_id": 1, "preview": "hi"},
        commit=False,
    )

    assert row.event_type == UserActivityType.COMMENT.value
    assert row.metadata_ == {"video_id": 1, "preview": "hi"}
