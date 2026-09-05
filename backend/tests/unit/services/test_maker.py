"""Unit tests for ``app.services.maker.MakerService``."""

from __future__ import annotations

from dataclasses import dataclass, field
from types import SimpleNamespace
from typing import Any, cast

import pytest

from app.repositories.maker import MakerRepository
from app.services.maker import MakerService


@dataclass
class FakeMakerRepository:
    """In-memory stand-in for ``MakerRepository``."""

    list_result: list[Any] = field(default_factory=list)
    count_result: int = 0
    list_calls: list[dict[str, Any]] = field(default_factory=list)
    count_calls: list[dict[str, Any]] = field(default_factory=list)

    async def list_makers(
        self,
        *,
        q: str | None = None,
        locale_key: str | None = None,
        load_aka: bool = False,
        limit: int = 20,
        offset: int = 0,
    ) -> list[Any]:
        """Return configured maker rows and record the call."""

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

    async def count_makers(
        self,
        *,
        q: str | None = None,
        locale_key: str | None = None,
    ) -> int:
        """Return configured total and record the call."""

        self.count_calls.append({"q": q, "locale_key": locale_key})

        return self.count_result

    async def get_by_id(self, maker_id: int) -> Any | None:
        """Return one row by id when present."""

        for row in self.list_result:
            if getattr(row, "id", None) == maker_id:
                return row

        return None


def _maker(
    *,
    maker_id: int = 1,
    name: str = "足コキ",
    ruby: str | None = "あしこき",
    dmm_id: str = "5048",
    akas: list[SimpleNamespace] | None = None,
) -> SimpleNamespace:
    return SimpleNamespace(
        id=maker_id,
        name=name,
        ruby=ruby,
        dmm_id=dmm_id,
        maker_aka=akas or [],
    )


@pytest.mark.asyncio
async def test_list_makers_empty() -> None:
    """Empty repository yields an empty page."""

    repo = FakeMakerRepository(list_result=[], count_result=0)
    service = MakerService(repository=cast(MakerRepository, repo))
    result = await service.list_makers()

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
async def test_list_makers_clamps_limit_and_offset() -> None:
    """Limit is capped at 100; non-positive values are normalized."""

    repo = FakeMakerRepository(list_result=[], count_result=0)
    service = MakerService(repository=cast(MakerRepository, repo))
    result = await service.list_makers(limit=500, offset=-3)

    assert result.limit == 100
    assert result.offset == 0
    assert repo.list_calls[0]["limit"] == 100
    assert repo.list_calls[0]["offset"] == 0


@pytest.mark.asyncio
async def test_list_makers_without_locale_uses_native_name() -> None:
    """Omitting locale keeps ``name`` as native Japanese."""

    row = _maker(
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
    repo = FakeMakerRepository(list_result=[row], count_result=1)
    service = MakerService(repository=cast(MakerRepository, repo))
    result = await service.list_makers()

    assert result.total == 1
    assert result.items[0].name == "4時間以上作品"


@pytest.mark.asyncio
async def test_list_makers_with_locale_uses_translated_name() -> None:
    """With locale, ``name`` uses matching aka translation."""

    row = _maker(
        akas=[
            SimpleNamespace(language="en-us", translated_name="MOODYZ"),
            SimpleNamespace(language="vi", translated_name="MOODYZ"),
        ],
    )
    repo = FakeMakerRepository(list_result=[row], count_result=1)
    service = MakerService(repository=cast(MakerRepository, repo))

    en_result = await service.list_makers(locale="en-us")
    assert en_result.items[0].name == "MOODYZ"
    assert repo.list_calls[-1]["locale_key"] == "en-us"
    assert repo.list_calls[-1]["load_aka"] is True


@pytest.mark.asyncio
async def test_list_makers_forwards_search_and_pagination() -> None:
    """Service forwards ``q``, locale, limit, and offset."""

    repo = FakeMakerRepository(list_result=[], count_result=0)
    service = MakerService(repository=cast(MakerRepository, repo))
    await service.list_makers(
        q="foot job",
        locale="en-us",
        limit=50,
        offset=10,
    )

    assert repo.list_calls == [
        {
            "q": "foot job",
            "locale_key": "en-us",
            "load_aka": True,
            "limit": 50,
            "offset": 10,
        },
    ]
    assert repo.count_calls == [
        {"q": "foot job", "locale_key": "en-us"},
    ]
