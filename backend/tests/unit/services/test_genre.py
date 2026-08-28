"""Unit tests for ``app.services.genre.GenreService``."""

from __future__ import annotations

import datetime
from dataclasses import dataclass, field
from types import SimpleNamespace
from typing import Any, cast

import pytest

from app.repositories.genre import GenreRepository
from app.services.genre import GenreService


@dataclass
class FakeGenreRepository:
    """In-memory stand-in for ``GenreRepository``."""

    list_result: list[Any] = field(default_factory=list)
    list_calls: list[dict[str, Any]] = field(default_factory=list)

    async def list_genres(self, *, load_aka: bool = False) -> list[Any]:
        """Return configured genre rows and record the call."""

        self.list_calls.append({"load_aka": load_aka})

        return list(self.list_result)

    async def get_by_id(self, genre_id: int) -> Any | None:
        """Return one row by id when present."""

        for row in self.list_result:
            if getattr(row, "id", None) == genre_id:
                return row

        return None


def _genre(
    *,
    genre_id: int = 1,
    name: str = "足コキ",
    ruby: str | None = "あしこき",
    dmm_id: str = "5048",
    akas: list[SimpleNamespace] | None = None,
) -> SimpleNamespace:
    return SimpleNamespace(
        id=genre_id,
        name=name,
        ruby=ruby,
        dmm_id=dmm_id,
        genre_aka=akas or [],
    )


@pytest.mark.asyncio
async def test_list_genres_empty() -> None:
    """Empty repository yields an empty list."""

    repo = FakeGenreRepository(list_result=[])
    service = GenreService(repository=cast(GenreRepository, repo))
    result = await service.list_genres()

    assert result == []
    assert repo.list_calls == [{"load_aka": False}]


@pytest.mark.asyncio
async def test_list_genres_without_locale_uses_native_name() -> None:
    """Omitting locale keeps ``name`` as native Japanese."""

    row = _genre(
        name="4時間以上作品",
        ruby="4じかんいじょうさくひん",
        dmm_id="6179",
        akas=[
            SimpleNamespace(
                language="en-us",
                translated_name="Titles Over 4 Hours",
            ),
        ],
    )
    repo = FakeGenreRepository(list_result=[row])
    service = GenreService(repository=cast(GenreRepository, repo))
    result = await service.list_genres()

    assert result[0].name == "4時間以上作品"
    assert repo.list_calls == [{"load_aka": False}]


@pytest.mark.asyncio
async def test_list_genres_with_locale_uses_translated_name() -> None:
    """With locale, ``name`` uses matching aka translation."""

    row = _genre(
        akas=[
            SimpleNamespace(language="en-us", translated_name="Footjob"),
            SimpleNamespace(language="vi", translated_name="Gót chân"),
        ],
    )
    repo = FakeGenreRepository(list_result=[row])
    service = GenreService(repository=cast(GenreRepository, repo))

    en_result = await service.list_genres(locale="en-us")
    assert en_result[0].name == "Footjob"
    assert repo.list_calls[-1] == {"load_aka": True}

    vi_result = await service.list_genres(locale="vi")
    assert vi_result[0].name == "Gót chân"


@pytest.mark.asyncio
async def test_list_genres_locale_fallback_to_native_name() -> None:
    """Missing aka for locale falls back to native Japanese name."""

    row = _genre(
        name="汗だく",
        dmm_id="5075",
        akas=[
            SimpleNamespace(language="en-us", translated_name="Sweaty"),
        ],
    )
    repo = FakeGenreRepository(list_result=[row])
    service = GenreService(repository=cast(GenreRepository, repo))

    result = await service.list_genres(locale="fr")
    assert result[0].name == "汗だく"


@pytest.mark.asyncio
async def test_get_genre_returns_detail_with_akas() -> None:
    """Detail payload keeps Japanese name and lists all akas."""

    created = datetime.datetime(2026, 1, 1, 12, 0, 0)
    updated = datetime.datetime(2026, 2, 1, 12, 0, 0)
    row = _genre(
        genre_id=6,
        name="足コキ",
        ruby="あしこき",
        dmm_id="5048",
        akas=[
            SimpleNamespace(
                id=10,
                language="vi",
                translated_name="Gót chân",
                created_at=created,
                updated_at=updated,
            ),
            SimpleNamespace(
                id=11,
                language="en-us",
                translated_name="Footjob",
                created_at=created,
                updated_at=updated,
            ),
        ],
    )
    # Attach timestamps on genre itself
    row.created_at = created
    row.updated_at = updated

    repo = FakeGenreRepository(list_result=[row])
    service = GenreService(repository=cast(GenreRepository, repo))
    result = await service.get_genre(6)

    assert result.id == 6
    assert result.name == "足コキ"
    assert result.ruby == "あしこき"
    assert result.dmm_id == "5048"
    assert result.created_at == created
    assert result.updated_at == updated
    assert len(result.akas) == 2
    assert result.akas[0].language == "en-us"
    assert result.akas[0].name == "Footjob"
    assert result.akas[1].language == "vi"
    payload = result.model_dump(by_alias=True)
    assert payload["dmmId"] == "5048"
    assert payload["createdAt"] == created
    assert payload["akas"][0]["name"] == "Footjob"


@pytest.mark.asyncio
async def test_get_genre_not_found() -> None:
    """Missing genre yields HTTP 404."""

    from fastapi import HTTPException, status

    repo = FakeGenreRepository(list_result=[])
    service = GenreService(repository=cast(GenreRepository, repo))

    with pytest.raises(HTTPException) as exc_info:
        await service.get_genre(999)

    assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND
