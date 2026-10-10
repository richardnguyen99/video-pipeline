"""Unit tests for ``app.services.actress_subscribe.ActressSubscribeService``."""

# pylint: disable=unused-argument

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Any, Optional, cast
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException, status

from app.models.user_actress_subscribe import UserActressSubscribe
from app.repositories.actress import ActressRepository
from app.services.actress_subscribe import ActressSubscribeService


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class _SessionSpy:
    """Session stand-in that records add / commit / refresh / delete."""

    def __init__(self) -> None:
        self.added: list[Any] = []
        self.committed = 0
        self.refreshed: list[Any] = []
        self.deleted: list[Any] = []
        self.exec_results: list[Any] = []

    def add(self, obj: Any) -> None:
        self.added.append(obj)

    async def commit(self) -> None:
        self.committed += 1

    async def refresh(self, obj: Any) -> None:
        self.refreshed.append(obj)

    async def delete(self, obj: Any) -> None:
        self.deleted.append(obj)

    async def exec(self, _statement: object) -> Any:
        first_value: Any = None

        if self.exec_results:
            first_value = self.exec_results.pop(0)

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
                return first_value

        return _ExecResult()


class _FakeActressRepository:
    """Repository stub with get_by_id and a session spy."""

    def __init__(
        self,
        *,
        actress: Optional[Any] = None,
        session: Optional[_SessionSpy] = None,
    ) -> None:
        self._actress = actress
        self.session = session if session is not None else _SessionSpy()

    async def get_by_id(self, actress_id: int) -> Optional[Any]:
        if self._actress is None:
            return None

        if getattr(self._actress, "id", None) != actress_id:
            return None

        return self._actress

    async def count_engagement_for_actresses(
        self,
        actress_ids: list[int],
    ) -> dict[int, dict[str, int]]:
        return {
            actress_id: {
                "video_cnt": 0,
                "sub_cnt": 0,
                "view_cnt": 12,
                "like_cnt": 3,
                "comment_cnt": 0,
            }
            for actress_id in actress_ids
        }


def _actress(
    *,
    actress_id: int = 10,
    name: str = "Sample Actress",
    image_url: Optional[str] = "https://example.com/a.jpg",
    ruby: Optional[str] = "sample",
) -> SimpleNamespace:
    return SimpleNamespace(
        id=actress_id,
        name=name,
        image_url=image_url,
        ruby=ruby,
        birthday="1995-04-12",
        bust=86,
        cup="D",
        waist=58,
        hip=88,
        height=160,
        actress_image=[],
        is_active=True,
    )


def _subscription(
    *,
    user_id: UUID,
    actress_id: int = 10,
) -> UserActressSubscribe:
    row = UserActressSubscribe.create(
        user_id=user_id,
        actress_id=actress_id,
    )
    row.created_at = _now()

    return row


def _service(
    repository: _FakeActressRepository,
) -> ActressSubscribeService:
    return ActressSubscribeService(
        repository=cast(ActressRepository, repository),
    )


@pytest.mark.asyncio
async def test_subscribe_raises_when_actress_missing() -> None:
    """Unknown actress ids yield HTTP 404."""

    service = _service(_FakeActressRepository(actress=None))

    with pytest.raises(HTTPException) as exc_info:
        await service.subscribe(user_id=uuid4(), actress_id=999)

    assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.asyncio
async def test_subscribe_creates_row_when_absent(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """First subscribe creates a row and reports subscribed."""

    user_id = uuid4()
    actress = _actress(actress_id=22)
    repository = _FakeActressRepository(actress=actress)
    service = _service(repository)
    created = _subscription(user_id=user_id, actress_id=22)

    async def _fake_subscribe(
        _session: object,
        *,
        user_id: UUID,
        actress_id: int,
    ) -> UserActressSubscribe:
        assert user_id == created.user_id
        assert actress_id == 22

        return created

    async def _fake_count(
        _session: object,
        actress_id: int,
    ) -> int:
        assert actress_id == 22

        return 4

    monkeypatch.setattr(UserActressSubscribe, "subscribe", _fake_subscribe)
    monkeypatch.setattr(
        UserActressSubscribe,
        "count_for_actress",
        _fake_count,
    )

    result = await service.subscribe(user_id=user_id, actress_id=22)

    assert result.actress_id == 22
    assert result.is_subscribed is True
    assert result.sub_cnt == 4


@pytest.mark.asyncio
async def test_unsubscribe_raises_when_actress_missing() -> None:
    """Unsubscribe on unknown actress yields HTTP 404."""

    service = _service(_FakeActressRepository(actress=None))

    with pytest.raises(HTTPException) as exc_info:
        await service.unsubscribe(user_id=uuid4(), actress_id=999)

    assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.asyncio
async def test_unsubscribe_clears_subscription(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Unsubscribe reports not subscribed and updated count."""

    user_id = uuid4()
    actress = _actress(actress_id=15)
    service = _service(_FakeActressRepository(actress=actress))

    async def _fake_unsubscribe(
        _session: object,
        *,
        user_id: UUID,
        actress_id: int,
    ) -> bool:
        assert user_id is not None
        assert actress_id == 15

        return True

    async def _fake_count(_session: object, actress_id: int) -> int:
        assert actress_id == 15

        return 2

    monkeypatch.setattr(
        UserActressSubscribe,
        "unsubscribe",
        _fake_unsubscribe,
    )
    monkeypatch.setattr(
        UserActressSubscribe,
        "count_for_actress",
        _fake_count,
    )

    result = await service.unsubscribe(user_id=user_id, actress_id=15)

    assert result.actress_id == 15
    assert result.is_subscribed is False
    assert result.sub_cnt == 2


@pytest.mark.asyncio
async def test_get_status_when_subscribed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Status reflects an existing subscription row."""

    user_id = uuid4()
    actress = _actress(actress_id=8)
    service = _service(_FakeActressRepository(actress=actress))
    existing = _subscription(user_id=user_id, actress_id=8)

    async def _fake_get(
        _session: object,
        *,
        user_id: UUID,
        actress_id: int,
    ) -> UserActressSubscribe:
        assert user_id == existing.user_id
        assert actress_id == 8

        return existing

    async def _fake_count(_session: object, actress_id: int) -> int:
        return 9

    monkeypatch.setattr(
        UserActressSubscribe,
        "get_by_user_and_actress",
        _fake_get,
    )
    monkeypatch.setattr(
        UserActressSubscribe,
        "count_for_actress",
        _fake_count,
    )

    result = await service.get_status(user_id=user_id, actress_id=8)

    assert result.is_subscribed is True
    assert result.sub_cnt == 9


@pytest.mark.asyncio
async def test_get_status_when_not_subscribed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Status is false when no subscription row exists."""

    user_id = uuid4()
    actress = _actress(actress_id=8)
    service = _service(_FakeActressRepository(actress=actress))

    async def _fake_get(
        _session: object,
        *,
        user_id: UUID,
        actress_id: int,
    ) -> None:
        return None

    async def _fake_count(_session: object, actress_id: int) -> int:
        return 1

    monkeypatch.setattr(
        UserActressSubscribe,
        "get_by_user_and_actress",
        _fake_get,
    )
    monkeypatch.setattr(
        UserActressSubscribe,
        "count_for_actress",
        _fake_count,
    )

    result = await service.get_status(user_id=user_id, actress_id=8)

    assert result.is_subscribed is False
    assert result.sub_cnt == 1


@pytest.mark.asyncio
async def test_list_for_user_empty(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Empty subscription lists return zero items."""

    user_id = uuid4()
    service = _service(_FakeActressRepository(actress=_actress()))

    async def _fake_list(
        _session: object,
        _user_id: UUID,
        *,
        limit: int,
        offset: int,
    ) -> list[UserActressSubscribe]:
        assert limit == 20
        assert offset == 0

        return []

    async def _fake_count(_session: object, _user_id: UUID) -> int:
        return 0

    monkeypatch.setattr(UserActressSubscribe, "list_for_user", _fake_list)
    monkeypatch.setattr(UserActressSubscribe, "count_for_user", _fake_count)

    result = await service.list_for_user(user_id=user_id)

    assert result.items == []
    assert result.total == 0
    assert result.limit == 20
    assert result.offset == 0


@pytest.mark.asyncio
async def test_list_for_user_maps_actress_fields(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """List items include actress name and image from loaded rows."""

    user_id = uuid4()
    session = _SessionSpy()
    actress = _actress(actress_id=33, name="Mapped", ruby="mapped")
    repository = _FakeActressRepository(actress=actress, session=session)
    service = _service(repository)
    row = _subscription(user_id=user_id, actress_id=33)
    session.exec_results = [[actress]]

    async def _fake_list(
        _session: object,
        _user_id: UUID,
        *,
        limit: int,
        offset: int,
    ) -> list[UserActressSubscribe]:
        return [row]

    async def _fake_count(_session: object, _user_id: UUID) -> int:
        return 1

    monkeypatch.setattr(UserActressSubscribe, "list_for_user", _fake_list)
    monkeypatch.setattr(UserActressSubscribe, "count_for_user", _fake_count)

    result = await service.list_for_user(user_id=user_id, limit=10, offset=0)

    assert result.total == 1
    assert len(result.items) == 1
    assert result.items[0].actress_id == 33
    assert result.items[0].name == "Mapped"
    assert result.items[0].ruby == "mapped"
    assert result.items[0].image_url == "https://example.com/a.jpg"
    assert result.items[0].view_cnt == 12
    assert result.items[0].like_cnt == 3


@pytest.mark.asyncio
async def test_list_for_username_raises_when_user_missing() -> None:
    """Unknown usernames yield HTTP 404."""

    session = _SessionSpy()
    session.exec_results = [None]
    repository = _FakeActressRepository(session=session)
    service = _service(repository)

    with pytest.raises(HTTPException) as exc_info:
        await service.list_for_username(username="missing-user")

    assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.asyncio
async def test_list_for_username_delegates_to_list_for_user(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Resolved users are forwarded to list_for_user."""

    user_id = uuid4()
    session = _SessionSpy()
    session.exec_results = [
        SimpleNamespace(id=user_id, username="alice", is_active=True),
    ]
    repository = _FakeActressRepository(session=session)
    service = _service(repository)
    called: dict[str, Any] = {}

    async def _fake_list_for_user(
        *,
        user_id: UUID,
        limit: int = 20,
        offset: int = 0,
    ) -> Any:
        called["user_id"] = user_id
        called["limit"] = limit
        called["offset"] = offset

        return SimpleNamespace(
            items=[],
            total=0,
            limit=limit,
            offset=offset,
        )

    monkeypatch.setattr(service, "list_for_user", _fake_list_for_user)

    result = await service.list_for_username(
        username="alice",
        limit=5,
        offset=2,
    )

    assert called["user_id"] == user_id
    assert called["limit"] == 5
    assert called["offset"] == 2
    assert result.total == 0


@pytest.mark.asyncio
async def test_list_for_username_rejects_inactive_user() -> None:
    """Inactive accounts are treated as not found."""

    session = _SessionSpy()
    session.exec_results = [
        SimpleNamespace(id=uuid4(), username="gone", is_active=False),
    ]
    service = _service(_FakeActressRepository(session=session))

    with pytest.raises(HTTPException) as exc_info:
        await service.list_for_username(username="gone")

    assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND
