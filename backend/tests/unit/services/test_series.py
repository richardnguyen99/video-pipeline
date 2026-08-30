"""Unit tests for ``app.services.series.SeriesService``."""

from __future__ import annotations

import datetime
from dataclasses import dataclass, field
from types import SimpleNamespace
from typing import Any, cast

import pytest
from fastapi import HTTPException, status

from app.repositories.series import SeriesRepository
from app.services.series import SeriesService


@dataclass
class FakeSeriesRepository:
    """In-memory stand-in for ``SeriesRepository``."""

    list_result: list[Any] = field(default_factory=list)
    count_result: int = 0
    list_calls: list[dict[str, Any]] = field(default_factory=list)
    count_calls: list[dict[str, Any]] = field(default_factory=list)

    async def list_series(
        self,
        *,
        q: str | None = None,
        locale_key: str | None = None,
        load_aka: bool = False,
        limit: int = 20,
        offset: int = 0,
    ) -> list[Any]:
        """Return configured series rows and record the call."""

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

    async def count_series(
        self,
        *,
        q: str | None = None,
        locale_key: str | None = None,
    ) -> int:
        """Return configured total and record the call."""

        self.count_calls.append({"q": q, "locale_key": locale_key})

        return self.count_result

    async def get_by_id(self, series_id: int) -> Any | None:
        """Return one row by id when present."""

        for row in self.list_result:
            if getattr(row, "id", None) == series_id:
                return row

        return None


def _series(
    *,
    series_id: int = 1,
    name: str = "ノンフィクション（teamZERO）",
    ruby: str | None = "のんふぃくしょん",
    dmm_id: str = "212560",
    akas: list[SimpleNamespace] | None = None,
) -> SimpleNamespace:
    return SimpleNamespace(
        id=series_id,
        name=name,
        ruby=ruby,
        dmm_id=dmm_id,
        series_aka=akas or [],
    )


@pytest.mark.asyncio
async def test_list_series_empty() -> None:
    """Empty repository yields an empty page."""

    repo = FakeSeriesRepository(list_result=[], count_result=0)
    service = SeriesService(repository=cast(SeriesRepository, repo))
    result = await service.list_series()

    assert result.items == []
    assert result.total == 0
    assert result.limit == 20
    assert result.offset == 0


@pytest.mark.asyncio
async def test_list_series_clamps_limit_and_offset() -> None:
    """Limit is capped at 100; non-positive values are normalized."""

    repo = FakeSeriesRepository(list_result=[], count_result=0)
    service = SeriesService(repository=cast(SeriesRepository, repo))
    result = await service.list_series(limit=500, offset=-3)

    assert result.limit == 100
    assert result.offset == 0
    assert repo.list_calls[0]["limit"] == 100
    assert repo.list_calls[0]["offset"] == 0


@pytest.mark.asyncio
async def test_list_series_without_locale_uses_native_name() -> None:
    """Omitting locale keeps ``name`` as native Japanese."""

    row = _series(
        akas=[
            SimpleNamespace(
                language="en-us",
                translated_name="Nonfiction (teamZERO)",
            ),
        ],
    )
    repo = FakeSeriesRepository(list_result=[row], count_result=1)
    service = SeriesService(repository=cast(SeriesRepository, repo))
    result = await service.list_series()

    assert result.total == 1
    assert result.items[0].name == "ノンフィクション（teamZERO）"
    assert repo.list_calls[0]["load_aka"] is False


@pytest.mark.asyncio
async def test_list_series_with_locale_uses_translated_name() -> None:
    """With locale, ``name`` uses matching aka translation."""

    row = _series(
        akas=[
            SimpleNamespace(
                language="en-us",
                translated_name="Nonfiction (teamZERO)",
            ),
        ],
    )
    repo = FakeSeriesRepository(list_result=[row], count_result=1)
    service = SeriesService(repository=cast(SeriesRepository, repo))
    result = await service.list_series(locale="en-us")

    assert result.items[0].name == "Nonfiction (teamZERO)"
    assert result.items[0].model_dump(by_alias=True)["dmmId"] == "212560"
    assert repo.list_calls[0]["load_aka"] is True


@pytest.mark.asyncio
async def test_list_series_forwards_search_and_pagination() -> None:
    """Service forwards ``q``, locale, limit, and offset."""

    repo = FakeSeriesRepository(list_result=[], count_result=0)
    service = SeriesService(repository=cast(SeriesRepository, repo))
    await service.list_series(
        q="team zero",
        locale="en-us",
        limit=50,
        offset=10,
    )

    assert repo.list_calls == [
        {
            "q": "team zero",
            "locale_key": "en-us",
            "load_aka": True,
            "limit": 50,
            "offset": 10,
        },
    ]
    assert repo.count_calls == [
        {"q": "team zero", "locale_key": "en-us"},
    ]


@pytest.mark.asyncio
async def test_get_series_returns_detail_with_akas() -> None:
    """Detail payload keeps Japanese name and lists all akas."""

    created = datetime.datetime(2026, 1, 1, 12, 0, 0)
    updated = datetime.datetime(2026, 2, 1, 12, 0, 0)
    row = _series(
        series_id=30167,
        name="ノンフィクション（teamZERO）",
        ruby="のんふぃくしょん",
        dmm_id="212560",
        akas=[
            SimpleNamespace(
                id=10,
                language="vi",
                translated_name="Nonfiction",
                created_at=created,
                updated_at=updated,
            ),
            SimpleNamespace(
                id=11,
                language="en-us",
                translated_name="Nonfiction (teamZERO)",
                created_at=created,
                updated_at=updated,
            ),
        ],
    )
    row.created_at = created
    row.updated_at = updated

    repo = FakeSeriesRepository(list_result=[row])
    service = SeriesService(repository=cast(SeriesRepository, repo))
    result = await service.get_series(30167)

    assert result.id == 30167
    assert result.name == "ノンフィクション（teamZERO）"
    assert result.ruby == "のんふぃくしょん"
    assert result.dmm_id == "212560"
    assert result.created_at == created
    assert result.updated_at == updated
    assert len(result.akas) == 2
    assert result.akas[0].language == "en-us"
    assert result.akas[0].name == "Nonfiction (teamZERO)"
    assert result.akas[1].language == "vi"
    payload = result.model_dump(by_alias=True)
    assert payload["dmmId"] == "212560"
    assert payload["createdAt"] == created
    assert payload["akas"][0]["name"] == "Nonfiction (teamZERO)"


@pytest.mark.asyncio
async def test_get_series_not_found() -> None:
    """Missing series yields HTTP 404."""

    repo = FakeSeriesRepository(list_result=[])
    service = SeriesService(repository=cast(SeriesRepository, repo))

    with pytest.raises(HTTPException) as exc_info:
        await service.get_series(999)

    assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND
