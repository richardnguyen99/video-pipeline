"""Unit tests for ``UserActressSubscribe`` model helpers."""

from __future__ import annotations

from typing import Any, Optional
from uuid import uuid4

import pytest

from app.models.user_actress_subscribe import UserActressSubscribe


class _SessionSpy:
    """Session stand-in for model-level helpers."""

    def __init__(self) -> None:
        self.added: list[Any] = []
        self.committed = 0
        self.refreshed: list[Any] = []
        self.deleted: list[Any] = []
        self.exec_first: Any = None
        self.exec_one: Any = None

    def add(self, obj: Any) -> None:
        self.added.append(obj)

    async def commit(self) -> None:
        self.committed += 1

    async def refresh(self, obj: Any) -> None:
        self.refreshed.append(obj)

    async def delete(self, obj: Any) -> None:
        self.deleted.append(obj)

    async def exec(self, _statement: object) -> Any:
        first_value = self.exec_first
        one_value = self.exec_one

        class _ExecResult:
            def first(self) -> Any:
                return first_value

            def all(self) -> list[Any]:
                if first_value is None:
                    return []

                if isinstance(first_value, list):
                    return first_value

                return [first_value]

            def one(self) -> Any:
                return one_value

        return _ExecResult()


def test_create_builds_instance_without_persisting() -> None:
    """create() does not touch the session."""

    user_id = uuid4()
    row = UserActressSubscribe.create(user_id=user_id, actress_id=5)

    assert row.user_id == user_id
    assert row.actress_id == 5


@pytest.mark.asyncio
async def test_subscribe_returns_existing_without_insert() -> None:
    """Idempotent subscribe returns the existing row."""

    session = _SessionSpy()
    user_id = uuid4()
    existing = UserActressSubscribe.create(user_id=user_id, actress_id=3)
    session.exec_first = existing

    result = await UserActressSubscribe.subscribe(
        session,  # type: ignore[arg-type]
        user_id=user_id,
        actress_id=3,
    )

    assert result is existing
    assert not session.added
    assert session.committed == 0


@pytest.mark.asyncio
async def test_subscribe_inserts_when_missing() -> None:
    """Missing pairs create a new row and commit."""

    session = _SessionSpy()
    session.exec_first = None
    user_id = uuid4()

    result = await UserActressSubscribe.subscribe(
        session,  # type: ignore[arg-type]
        user_id=user_id,
        actress_id=11,
    )

    assert result.user_id == user_id
    assert result.actress_id == 11
    assert len(session.added) == 1
    assert session.committed == 1
    assert len(session.refreshed) == 1


@pytest.mark.asyncio
async def test_unsubscribe_returns_false_when_missing() -> None:
    """Unsubscribe is a no-op when no row exists."""

    session = _SessionSpy()
    session.exec_first = None

    deleted = await UserActressSubscribe.unsubscribe(
        session,  # type: ignore[arg-type]
        user_id=uuid4(),
        actress_id=1,
    )

    assert deleted is False
    assert not session.deleted


@pytest.mark.asyncio
async def test_unsubscribe_deletes_existing() -> None:
    """Existing rows are deleted and committed."""

    session = _SessionSpy()
    user_id = uuid4()
    existing = UserActressSubscribe.create(user_id=user_id, actress_id=9)
    session.exec_first = existing

    deleted = await UserActressSubscribe.unsubscribe(
        session,  # type: ignore[arg-type]
        user_id=user_id,
        actress_id=9,
    )

    assert deleted is True
    assert session.deleted == [existing]
    assert session.committed == 1


@pytest.mark.asyncio
async def test_count_for_actress() -> None:
    """count_for_actress returns the scalar count."""

    session = _SessionSpy()
    session.exec_one = 7

    total = await UserActressSubscribe.count_for_actress(
        session,  # type: ignore[arg-type]
        42,
    )

    assert total == 7


@pytest.mark.asyncio
async def test_count_for_user() -> None:
    """count_for_user returns the scalar count."""

    session = _SessionSpy()
    session.exec_one = 3

    total = await UserActressSubscribe.count_for_user(
        session,  # type: ignore[arg-type]
        uuid4(),
    )

    assert total == 3


@pytest.mark.asyncio
async def test_list_for_user_returns_rows() -> None:
    """list_for_user returns ordered subscription rows."""

    session = _SessionSpy()
    user_id = uuid4()
    row = UserActressSubscribe.create(user_id=user_id, actress_id=2)
    session.exec_first = [row]

    rows = await UserActressSubscribe.list_for_user(
        session,  # type: ignore[arg-type]
        user_id,
        limit=10,
        offset=0,
    )

    assert rows == [row]


@pytest.mark.asyncio
async def test_get_by_user_and_actress_returns_first() -> None:
    """Lookup returns the first matching row."""

    session = _SessionSpy()
    user_id = uuid4()
    row = UserActressSubscribe.create(user_id=user_id, actress_id=4)
    session.exec_first = row

    found: Optional[UserActressSubscribe] = (
        await UserActressSubscribe.get_by_user_and_actress(
            session,  # type: ignore[arg-type]
            user_id=user_id,
            actress_id=4,
        )
    )

    assert found is row
