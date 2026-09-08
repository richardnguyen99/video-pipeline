"""Unit tests for ``app.services.director.DirectorService``."""

from __future__ import annotations

import datetime
from dataclasses import dataclass, field
from types import SimpleNamespace
from typing import Any, cast

import pytest
from fastapi import HTTPException, status

from app.repositories.director import DirectorRepository
from app.services.director import DirectorService


@dataclass
class FakeDirectorRepository:
    """In-memory stand-in for ``DirectorRepository``."""

    list_result: list[Any] = field(default_factory=list)
    count_result: int = 0
    list_calls: list[dict[str, Any]] = field(default_factory=list)
    count_calls: list[dict[str, Any]] = field(default_factory=list)

    async def list_directors(
        self,
        *,
        q: str | None = None,
        locale_key: str | None = None,
        load_aka: bool = False,
        limit: int = 20,
        offset: int = 0,
    ) -> list[Any]:
        """Return configured director rows and record the call."""

        self.list_calls.append(
            {
                "q": q,
                "locale_key": locale_key,
                "load_aka": load_aka,
                "limit": limit,
                "offset": offset,
            },
        )

        return list(self.list_result)

    async def count_directors(
        self,
        *,
        q: str | None = None,
        locale_key: str | None = None,
    ) -> int:
        """Return configured total and record the call."""

        self.count_calls.append({"q": q, "locale_key": locale_key})

        return self.count_result

    async def get_by_id(self, director_id: int) -> Any | None:
        """Return one row by id when present."""

        for row in self.list_result:
            if getattr(row, "id", None) == director_id:
                return row

        return None


def _director(
    *,
    director_id: int = 1,
    name: str = "キョウセイ",
    ruby: str | None = "きょうせい",
    dmm_id: str = "3001",
    akas: list[SimpleNamespace] | None = None,
) -> SimpleNamespace:
    return SimpleNamespace(
        id=director_id,
        name=name,
        ruby=ruby,
        dmm_id=dmm_id,
        director_aka=akas or [],
    )


@pytest.mark.asyncio
async def test_list_directors_empty() -> None:
    """Empty repository yields an empty page."""

    repo = FakeDirectorRepository(list_result=[], count_result=0)
    service = DirectorService(repository=cast(DirectorRepository, repo))
    result = await service.list_directors()

    assert result.items == []
    assert result.total == 0
    assert result.limit == 20
    assert result.offset == 0
    assert repo.list_calls == [
        {
            "q": None,
            "locale_key": None,
            "load_aka": False,
            "limit": 20,
            "offset": 0,
        },
    ]


@pytest.mark.asyncio
async def test_list_directors_clamps_limit_and_offset() -> None:
    """Limit is capped at 100; non-positive values are normalized."""

    repo = FakeDirectorRepository(list_result=[], count_result=0)
    service = DirectorService(repository=cast(DirectorRepository, repo))
    result = await service.list_directors(limit=500, offset=-3)

    assert result.limit == 100
    assert result.offset == 0
    assert repo.list_calls[0]["limit"] == 100
    assert repo.list_calls[0]["offset"] == 0


@pytest.mark.asyncio
async def test_list_directors_without_locale_uses_native_name() -> None:
    """Omitting locale keeps ``name`` as native Japanese."""

    row = _director(
        name="キョウセイ",
        ruby="きょうせい",
        dmm_id="3001",
        akas=[
            SimpleNamespace(
                language="en-us",
                translated_name="Kyousei",
            ),
        ],
    )
    repo = FakeDirectorRepository(list_result=[row], count_result=1)
    service = DirectorService(repository=cast(DirectorRepository, repo))
    result = await service.list_directors()

    assert result.total == 1
    assert result.items[0].name == "キョウセイ"


@pytest.mark.asyncio
async def test_list_directors_with_locale_uses_translated_name() -> None:
    """With locale, ``name`` uses matching aka translation."""

    row = _director(
        akas=[
            SimpleNamespace(language="en-us", translated_name="Kyousei"),
            SimpleNamespace(language="vi", translated_name="Kyousei"),
        ],
    )
    repo = FakeDirectorRepository(list_result=[row], count_result=1)
    service = DirectorService(repository=cast(DirectorRepository, repo))

    en_result = await service.list_directors(locale="en-us")
    assert en_result.items[0].name == "Kyousei"
    assert repo.list_calls[-1]["locale_key"] == "en-us"
    assert repo.list_calls[-1]["load_aka"] is True


@pytest.mark.asyncio
async def test_list_directors_forwards_search_and_pagination() -> None:
    """Service forwards ``q``, locale, limit, and offset."""

    repo = FakeDirectorRepository(list_result=[], count_result=0)
    service = DirectorService(repository=cast(DirectorRepository, repo))
    await service.list_directors(
        q="kyousei soft",
        locale="en-us",
        limit=50,
        offset=10,
    )

    assert repo.list_calls == [
        {
            "q": "kyousei soft",
            "locale_key": "en-us",
            "load_aka": True,
            "limit": 50,
            "offset": 10,
        },
    ]
    assert repo.count_calls == [
        {"q": "kyousei soft", "locale_key": "en-us"},
    ]


@pytest.mark.asyncio
async def test_get_director_returns_detail_with_akas() -> None:
    """Detail payload keeps Japanese name and lists all akas."""

    created = datetime.datetime(2026, 1, 1, 12, 0, 0)
    updated = datetime.datetime(2026, 2, 1, 12, 0, 0)
    row = _director(
        director_id=3001,
        name="キョウセイ",
        ruby="きょうせい",
        dmm_id="3001",
        akas=[
            SimpleNamespace(
                id=10,
                language="vi",
                translated_name="Kyousei",
                created_at=created,
                updated_at=updated,
            ),
            SimpleNamespace(
                id=11,
                language="en-us",
                translated_name="Kyousei",
                created_at=created,
                updated_at=updated,
            ),
        ],
    )
    row.created_at = created
    row.updated_at = updated

    repo = FakeDirectorRepository(list_result=[row])
    service = DirectorService(repository=cast(DirectorRepository, repo))
    result = await service.get_director(3001)

    assert result.id == 3001
    assert result.name == "キョウセイ"
    assert len(result.akas) == 2
    assert result.akas[0].name == "Kyousei"
    assert result.akas[0].language == "en-us"
    payload = result.model_dump(by_alias=True)
    assert payload["dmmId"] == "3001"
    assert payload["createdAt"] == created
    assert payload["updatedAt"] == updated


@pytest.mark.asyncio
async def test_get_director_not_found() -> None:
    """Missing director yields HTTP 404."""

    repo = FakeDirectorRepository(list_result=[])
    service = DirectorService(repository=cast(DirectorRepository, repo))

    with pytest.raises(HTTPException) as exc_info:
        await service.get_director(999)

    assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND
