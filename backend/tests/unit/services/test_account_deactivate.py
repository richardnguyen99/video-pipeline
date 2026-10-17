"""Unit tests for ``app.services.account_deactivate``."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional, cast
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from app.models.user import User
from app.services.account_deactivate import AccountDeactivateService


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class _SessionSpy:
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


class _UserRepoSpy:
    def __init__(self, user: Optional[User] = None) -> None:
        self._user = user
        self.bumped: list[UUID] = []

    async def get_by_id(self, user_id: UUID) -> Optional[User]:
        if self._user is not None and self._user.id == user_id:
            return self._user

        return None

    async def bump_sessions_revoked_at(self, user_id: UUID) -> None:
        self.bumped.append(user_id)


class _RefreshRepoSpy:
    def __init__(self) -> None:
        self.revoked: list[UUID] = []

    async def revoke_all_for_user(self, user_id: UUID) -> int:
        self.revoked.append(user_id)

        return 1


def _user(*, is_active: bool = True) -> User:
    return User(
        id=uuid4(),
        username="alice",
        email="alice@example.com",
        display_name="Alice",
        role="user",
        is_active=is_active,
        deactivated_at=None,
        email_verified=True,
        created_at=_now(),
        updated_at=_now(),
    )


@pytest.mark.asyncio
async def test_deactivate_marks_inactive_and_revokes_sessions() -> None:
    user = _user()
    session = _SessionSpy()
    users = _UserRepoSpy(user)
    refresh = _RefreshRepoSpy()
    service = AccountDeactivateService(
        cast(Any, session),
        users=cast(Any, users),
        refresh_tokens=cast(Any, refresh),
    )

    result = await service.deactivate(user_id=user.id)

    assert result.is_active is False
    assert result.deactivated_at is not None
    assert user.is_active is False
    assert user.deactivated_at is not None
    assert session.committed == 1
    assert refresh.revoked == [user.id]
    assert users.bumped == [user.id]


@pytest.mark.asyncio
async def test_deactivate_missing_user_raises_404() -> None:
    session = _SessionSpy()
    service = AccountDeactivateService(
        cast(Any, session),
        users=cast(Any, _UserRepoSpy(None)),
        refresh_tokens=cast(Any, _RefreshRepoSpy()),
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.deactivate(user_id=uuid4())

    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_deactivate_already_inactive_raises_400() -> None:
    user = _user(is_active=False)
    session = _SessionSpy()
    service = AccountDeactivateService(
        cast(Any, session),
        users=cast(Any, _UserRepoSpy(user)),
        refresh_tokens=cast(Any, _RefreshRepoSpy()),
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.deactivate(user_id=user.id)

    assert exc_info.value.status_code == 400
