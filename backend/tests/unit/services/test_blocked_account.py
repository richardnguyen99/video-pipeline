"""Unit tests for ``app.services.blocked_account``."""

# pylint: disable=unused-argument

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional, cast
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from app.models.user import User
from app.models.user_blocked_account import UserBlockedAccount
from app.schemas.blocked_account import BlockUserRequest
from app.services.blocked_account import BlockedAccountService


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class _SessionSpy:
    """Session stand-in that records add / delete / commit / refresh."""

    def __init__(self) -> None:
        self.added: list[Any] = []
        self.deleted: list[Any] = []
        self.committed = 0
        self.refreshed: list[Any] = []
        self._users: dict[UUID, User] = {}
        self._by_username: dict[str, User] = {}

    def add(self, obj: Any) -> None:
        self.added.append(obj)

    async def delete(self, obj: Any) -> None:
        self.deleted.append(obj)

    async def commit(self) -> None:
        self.committed += 1

    async def refresh(self, obj: Any) -> None:
        self.refreshed.append(obj)

    def register_user(self, user: User) -> None:
        self._users[user.id] = user
        self._by_username[user.username] = user

    async def exec(self, statement: Any) -> Any:
        """Minimal exec that returns registered users for select(User)."""

        class _Result:
            def __init__(self, rows: list[Any]) -> None:
                self._rows = rows

            def first(self) -> Any:
                return self._rows[0] if self._rows else None

            def all(self) -> list[Any]:
                return list(self._rows)

        # Best-effort: return all registered users when listing by ids.
        return _Result(list(self._users.values()))


def _user(
    *,
    username: str = "alice",
    display_name: Optional[str] = "Alice Wonder",
) -> User:
    return User(
        id=uuid4(),
        username=username,
        email=f"{username}@example.com",
        display_name=display_name,
        role="user",
        is_active=True,
        email_verified=True,
        created_at=_now(),
        updated_at=_now(),
    )


def _block(
    *,
    blocker_id: UUID,
    blocked_id: UUID,
) -> UserBlockedAccount:
    return UserBlockedAccount(
        id=uuid4(),
        blocker_id=blocker_id,
        blocked_id=blocked_id,
        created_at=_now(),
    )


@pytest.mark.asyncio
async def test_list_blocked_empty(monkeypatch: pytest.MonkeyPatch) -> None:
    """Unset blockers receive an empty list."""

    session = _SessionSpy()

    async def _list(
        _session: object,
        *,
        blocker_id: UUID,
    ) -> list[UserBlockedAccount]:
        return []

    monkeypatch.setattr(UserBlockedAccount, "list_by_blocker", _list)

    service = BlockedAccountService(session=cast(Any, session))
    result = await service.list_blocked(blocker_id=uuid4())

    assert result.items == []
    assert result.total == 0


@pytest.mark.asyncio
async def test_list_blocked_maps_users(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Blocked rows are joined to user profile fields."""

    blocker_id = uuid4()
    blocked = _user(username="bob", display_name="Bob Builder")
    row = _block(blocker_id=blocker_id, blocked_id=blocked.id)
    session = _SessionSpy()
    session.register_user(blocked)

    async def _list(
        _session: object,
        *,
        blocker_id: UUID,
    ) -> list[UserBlockedAccount]:
        return [row]

    monkeypatch.setattr(UserBlockedAccount, "list_by_blocker", _list)

    service = BlockedAccountService(session=cast(Any, session))
    result = await service.list_blocked(blocker_id=blocker_id)

    assert result.total == 1
    assert result.items[0].id == blocked.id
    assert result.items[0].username == "bob"
    assert result.items[0].display_name == "Bob Builder"
    assert result.items[0].initials == "BB"


@pytest.mark.asyncio
async def test_block_user_rejects_self(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Blocking yourself is a 400."""

    me = _user(username="me")
    session = _SessionSpy()
    session.register_user(me)

    async def _get(
        _session: object,
        *,
        blocker_id: UUID,
        blocked_id: UUID,
    ) -> Optional[UserBlockedAccount]:
        return None

    monkeypatch.setattr(
        UserBlockedAccount,
        "get_by_blocker_and_blocked",
        _get,
    )

    # Patch resolve via session.exec returning me for any select
    service = BlockedAccountService(session=cast(Any, session))

    with pytest.raises(HTTPException) as exc_info:
        await service.block_user(
            blocker_id=me.id,
            payload=BlockUserRequest(user_id=me.id),
        )

    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_block_user_creates_row(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Block creates a new association when none exists."""

    blocker_id = uuid4()
    target = _user(username="target", display_name="T User")
    session = _SessionSpy()
    session.register_user(target)

    async def _get(
        _session: object,
        *,
        blocker_id: UUID,
        blocked_id: UUID,
    ) -> Optional[UserBlockedAccount]:
        return None

    monkeypatch.setattr(
        UserBlockedAccount,
        "get_by_blocker_and_blocked",
        _get,
    )

    service = BlockedAccountService(session=cast(Any, session))
    result = await service.block_user(
        blocker_id=blocker_id,
        payload=BlockUserRequest(username="target"),
    )

    assert result.id == target.id
    assert result.username == "target"
    assert len(session.added) == 1
    assert session.committed == 1


@pytest.mark.asyncio
async def test_block_user_idempotent(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Re-blocking an already blocked user returns the existing row."""

    blocker_id = uuid4()
    target = _user(username="target")
    existing = _block(blocker_id=blocker_id, blocked_id=target.id)
    session = _SessionSpy()
    session.register_user(target)

    async def _get(
        _session: object,
        *,
        blocker_id: UUID,
        blocked_id: UUID,
    ) -> Optional[UserBlockedAccount]:
        return existing

    monkeypatch.setattr(
        UserBlockedAccount,
        "get_by_blocker_and_blocked",
        _get,
    )

    service = BlockedAccountService(session=cast(Any, session))
    result = await service.block_user(
        blocker_id=blocker_id,
        payload=BlockUserRequest(user_id=target.id),
    )

    assert result.id == target.id
    assert not session.added
    assert session.committed == 0


@pytest.mark.asyncio
async def test_unblock_user_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Unblocking a non-existent relationship is a 404."""

    session = _SessionSpy()

    async def _get(
        _session: object,
        *,
        blocker_id: UUID,
        blocked_id: UUID,
    ) -> Optional[UserBlockedAccount]:
        return None

    monkeypatch.setattr(
        UserBlockedAccount,
        "get_by_blocker_and_blocked",
        _get,
    )

    service = BlockedAccountService(session=cast(Any, session))

    with pytest.raises(HTTPException) as exc_info:
        await service.unblock_user(
            blocker_id=uuid4(),
            blocked_id=uuid4(),
        )

    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_unblock_user_deletes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Unblock removes the association row."""

    blocker_id = uuid4()
    blocked_id = uuid4()
    existing = _block(blocker_id=blocker_id, blocked_id=blocked_id)
    session = _SessionSpy()

    async def _get(
        _session: object,
        *,
        blocker_id: UUID,
        blocked_id: UUID,
    ) -> Optional[UserBlockedAccount]:
        return existing

    monkeypatch.setattr(
        UserBlockedAccount,
        "get_by_blocker_and_blocked",
        _get,
    )

    service = BlockedAccountService(session=cast(Any, session))
    await service.unblock_user(
        blocker_id=blocker_id,
        blocked_id=blocked_id,
    )

    assert existing in session.deleted
    assert session.committed == 1
