"""Unit tests for ``app.services.content_preference.ContentPreferenceService``."""

# pylint: disable=unused-argument

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Any, Optional, cast
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException, status

from app.models.user_content_preference import (
    PreferenceEntityType,
    PreferencePolarity,
    UserContentPreference,
)
from app.schemas.content_preference import ContentPreferenceCreateRequest
from app.services.content_preference import ContentPreferenceService


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

        return _ExecResult()


def _preference(
    *,
    user_id: UUID,
    polarity: str = PreferencePolarity.INTEREST.value,
    entity_type: str = PreferenceEntityType.GENRE.value,
    entity_id: int = 1,
) -> UserContentPreference:
    return UserContentPreference(
        id=uuid4(),
        user_id=user_id,
        polarity=polarity,
        entity_type=entity_type,
        entity_id=entity_id,
        created_at=_now(),
    )


@pytest.mark.asyncio
async def test_list_preferences_splits_interests_and_dislikes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """List groups rows by polarity."""

    user_id = uuid4()
    interest = _preference(
        user_id=user_id, polarity=PreferencePolarity.INTEREST.value
    )
    dislike = _preference(
        user_id=user_id,
        polarity=PreferencePolarity.DISLIKE.value,
        entity_id=2,
    )
    session = _SessionSpy()

    async def _list_for_user(
        _session: object,
        *,
        user_id: UUID,
        polarity: Optional[str] = None,
    ) -> list[UserContentPreference]:
        assert polarity is None

        return [interest, dislike]

    monkeypatch.setattr(UserContentPreference, "list_for_user", _list_for_user)

    service = ContentPreferenceService(session=cast(Any, session))
    result = await service.list_preferences(user_id=user_id)

    assert len(result.interests) == 1
    assert result.interests[0].entity_id == 1
    assert result.interests[0].polarity == PreferencePolarity.INTEREST.value
    assert len(result.dislikes) == 1
    assert result.dislikes[0].entity_id == 2
    assert result.dislikes[0].polarity == PreferencePolarity.DISLIKE.value


@pytest.mark.asyncio
async def test_list_preferences_empty(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Empty preference list returns empty interest and dislike collections."""

    session = _SessionSpy()

    async def _list_for_user(
        _session: object,
        *,
        user_id: UUID,
        polarity: Optional[str] = None,
    ) -> list[UserContentPreference]:
        return []

    monkeypatch.setattr(UserContentPreference, "list_for_user", _list_for_user)

    service = ContentPreferenceService(session=cast(Any, session))
    result = await service.list_preferences(user_id=uuid4())

    assert result.interests == []
    assert result.dislikes == []


@pytest.mark.asyncio
async def test_upsert_preference_creates_row(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Upsert creates a new preference when none exists."""

    user_id = uuid4()
    session = _SessionSpy()
    session.exec_results.append(SimpleNamespace(id=7, name="Action"))

    async def _get_by_user_and_entity(
        _session: object,
        *,
        user_id: UUID,
        entity_type: str,
        entity_id: int,
    ) -> Optional[UserContentPreference]:
        return None

    monkeypatch.setattr(
        UserContentPreference,
        "get_by_user_and_entity",
        _get_by_user_and_entity,
    )

    service = ContentPreferenceService(session=cast(Any, session))
    payload = ContentPreferenceCreateRequest(
        polarity=PreferencePolarity.INTEREST.value,
        entity_type=PreferenceEntityType.GENRE.value,
        entity_id=7,
    )
    item = await service.upsert_preference(user_id=user_id, payload=payload)

    assert item.polarity == PreferencePolarity.INTEREST.value
    assert item.entity_type == PreferenceEntityType.GENRE.value
    assert item.entity_id == 7
    assert item.entity_name == "Action"
    assert len(session.added) == 1
    assert session.committed == 1
    assert session.refreshed == session.added


@pytest.mark.asyncio
async def test_upsert_preference_updates_polarity(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Upsert replaces polarity when the entity preference already exists."""

    user_id = uuid4()
    existing = _preference(
        user_id=user_id,
        polarity=PreferencePolarity.INTEREST.value,
        entity_id=7,
    )
    session = _SessionSpy()
    session.exec_results.append(SimpleNamespace(id=7, name="Action"))

    async def _get_by_user_and_entity(
        _session: object,
        *,
        user_id: UUID,
        entity_type: str,
        entity_id: int,
    ) -> Optional[UserContentPreference]:
        return existing

    monkeypatch.setattr(
        UserContentPreference,
        "get_by_user_and_entity",
        _get_by_user_and_entity,
    )

    service = ContentPreferenceService(session=cast(Any, session))
    payload = ContentPreferenceCreateRequest(
        polarity=PreferencePolarity.DISLIKE.value,
        entity_type=PreferenceEntityType.GENRE.value,
        entity_id=7,
    )
    item = await service.upsert_preference(user_id=user_id, payload=payload)

    assert item.polarity == PreferencePolarity.DISLIKE.value
    assert existing.polarity == PreferencePolarity.DISLIKE.value
    assert session.committed == 1
    assert existing in session.added


@pytest.mark.asyncio
async def test_upsert_preference_entity_not_found(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Upsert raises 404 when the catalog entity does not exist."""

    session = _SessionSpy()
    session.exec_results.append(None)

    service = ContentPreferenceService(session=cast(Any, session))
    payload = ContentPreferenceCreateRequest(
        polarity=PreferencePolarity.INTEREST.value,
        entity_type=PreferenceEntityType.GENRE.value,
        entity_id=999,
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.upsert_preference(user_id=uuid4(), payload=payload)

    assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.asyncio
async def test_remove_preference_deletes_existing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Remove deletes the matching preference row."""

    user_id = uuid4()
    existing = _preference(user_id=user_id, entity_id=3)
    session = _SessionSpy()

    async def _get_by_user_and_entity(
        _session: object,
        *,
        user_id: UUID,
        entity_type: str,
        entity_id: int,
    ) -> Optional[UserContentPreference]:
        return existing

    monkeypatch.setattr(
        UserContentPreference,
        "get_by_user_and_entity",
        _get_by_user_and_entity,
    )

    service = ContentPreferenceService(session=cast(Any, session))
    await service.remove_preference(
        user_id=user_id,
        entity_type=PreferenceEntityType.GENRE.value,
        entity_id=3,
    )

    assert session.deleted == [existing]
    assert session.committed == 1


@pytest.mark.asyncio
async def test_remove_preference_missing_is_noop(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Remove is a no-op when the preference does not exist."""

    session = _SessionSpy()

    async def _get_by_user_and_entity(
        _session: object,
        *,
        user_id: UUID,
        entity_type: str,
        entity_id: int,
    ) -> Optional[UserContentPreference]:
        return None

    monkeypatch.setattr(
        UserContentPreference,
        "get_by_user_and_entity",
        _get_by_user_and_entity,
    )

    service = ContentPreferenceService(session=cast(Any, session))
    await service.remove_preference(
        user_id=uuid4(),
        entity_type=PreferenceEntityType.GENRE.value,
        entity_id=3,
    )

    assert session.deleted == []
    assert session.committed == 0


@pytest.mark.asyncio
async def test_clear_polarity_deletes_matching_rows(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Clear polarity removes every preference of that polarity."""

    user_id = uuid4()
    rows = [
        _preference(user_id=user_id, entity_id=1),
        _preference(user_id=user_id, entity_id=2),
    ]
    session = _SessionSpy()

    async def _list_for_user(
        _session: object,
        *,
        user_id: UUID,
        polarity: Optional[str] = None,
    ) -> list[UserContentPreference]:
        assert polarity == PreferencePolarity.INTEREST.value

        return rows

    monkeypatch.setattr(UserContentPreference, "list_for_user", _list_for_user)

    service = ContentPreferenceService(session=cast(Any, session))
    await service.clear_polarity(
        user_id=user_id,
        polarity=PreferencePolarity.INTEREST.value,
    )

    assert session.deleted == rows
    assert session.committed == 1


@pytest.mark.asyncio
async def test_clear_polarity_rejects_invalid_value() -> None:
    """Clear polarity rejects values outside interest/dislike."""

    session = _SessionSpy()
    service = ContentPreferenceService(session=cast(Any, session))

    with pytest.raises(HTTPException) as exc_info:
        await service.clear_polarity(user_id=uuid4(), polarity="maybe")

    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
    assert session.deleted == []
