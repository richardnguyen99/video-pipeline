"""Unit tests for ``app.services.label.LabelService``."""

from __future__ import annotations

import datetime
from dataclasses import dataclass, field
from types import SimpleNamespace
from typing import Any, cast

import pytest
from fastapi import HTTPException, status

from app.repositories.label import LabelRepository
from app.services.label import LabelService


@dataclass
class FakeLabelRepository:
    """In-memory stand-in for ``LabelRepository``."""

    list_result: list[Any] = field(default_factory=list)
    count_result: int = 0
    list_calls: list[dict[str, Any]] = field(default_factory=list)
    count_calls: list[dict[str, Any]] = field(default_factory=list)

    async def list_labels(
        self,
        *,
        q: str | None = None,
        locale_key: str | None = None,
        load_aka: bool = False,
        limit: int = 20,
        offset: int = 0,
    ) -> list[Any]:
        """Return configured label rows and record the call."""

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

    async def count_labels(
        self,
        *,
        q: str | None = None,
        locale_key: str | None = None,
    ) -> int:
        """Return configured total and record the call."""

        self.count_calls.append({"q": q, "locale_key": locale_key})

        return self.count_result

    async def get_by_id(self, label_id: int) -> Any | None:
        """Return one row by id when present."""

        for row in self.list_result:
            if getattr(row, "id", None) == label_id:
                return row

        return None


def _label(
    *,
    label_id: int = 1,
    name: str = "プレミアム",
    ruby: str | None = "ぷれみあむ",
    dmm_id: str = "5001",
    akas: list[SimpleNamespace] | None = None,
) -> SimpleNamespace:
    return SimpleNamespace(
        id=label_id,
        name=name,
        ruby=ruby,
        dmm_id=dmm_id,
        label_aka=akas or [],
    )


@pytest.mark.asyncio
async def test_list_labels_empty() -> None:
    """Empty repository yields an empty page."""

    repo = FakeLabelRepository(list_result=[], count_result=0)
    service = LabelService(repository=cast(LabelRepository, repo))
    result = await service.list_labels()

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
async def test_list_labels_clamps_limit_and_offset() -> None:
    """Limit is capped at 100; non-positive values are normalized."""

    repo = FakeLabelRepository(list_result=[], count_result=0)
    service = LabelService(repository=cast(LabelRepository, repo))
    result = await service.list_labels(limit=500, offset=-3)

    assert result.limit == 100
    assert result.offset == 0
    assert repo.list_calls[0]["limit"] == 100
    assert repo.list_calls[0]["offset"] == 0


@pytest.mark.asyncio
async def test_list_labels_without_locale_uses_native_name() -> None:
    """Omitting locale keeps ``name`` as native Japanese."""

    row = _label(
        name="プレミアム",
        ruby="ぷれみあむ",
        dmm_id="5001",
        akas=[
            SimpleNamespace(
                language="en-us",
                translated_name="Premium",
            ),
        ],
    )
    repo = FakeLabelRepository(list_result=[row], count_result=1)
    service = LabelService(repository=cast(LabelRepository, repo))
    result = await service.list_labels()

    assert result.total == 1
    assert result.items[0].name == "プレミアム"


@pytest.mark.asyncio
async def test_list_labels_with_locale_uses_translated_name() -> None:
    """With locale, ``name`` uses matching aka translation."""

    row = _label(
        akas=[
            SimpleNamespace(language="en-us", translated_name="Premium"),
            SimpleNamespace(language="vi", translated_name="Premium"),
        ],
    )
    repo = FakeLabelRepository(list_result=[row], count_result=1)
    service = LabelService(repository=cast(LabelRepository, repo))

    en_result = await service.list_labels(locale="en-us")
    assert en_result.items[0].name == "Premium"
    assert repo.list_calls[-1]["locale_key"] == "en-us"
    assert repo.list_calls[-1]["load_aka"] is True


@pytest.mark.asyncio
async def test_list_labels_forwards_search_and_pagination() -> None:
    """Service forwards ``q``, locale, limit, and offset."""

    repo = FakeLabelRepository(list_result=[], count_result=0)
    service = LabelService(repository=cast(LabelRepository, repo))
    await service.list_labels(
        q="premium soft",
        locale="en-us",
        limit=50,
        offset=10,
    )

    assert repo.list_calls == [
        {
            "q": "premium soft",
            "locale_key": "en-us",
            "load_aka": True,
            "limit": 50,
            "offset": 10,
        },
    ]
    assert repo.count_calls == [
        {"q": "premium soft", "locale_key": "en-us"},
    ]


@pytest.mark.asyncio
async def test_get_label_returns_detail_with_akas() -> None:
    """Detail payload keeps Japanese name and lists all akas."""

    created = datetime.datetime(2026, 1, 1, 12, 0, 0)
    updated = datetime.datetime(2026, 2, 1, 12, 0, 0)
    row = _label(
        label_id=5001,
        name="プレミアム",
        ruby="ぷれみあむ",
        dmm_id="5001",
        akas=[
            SimpleNamespace(
                id=10,
                language="vi",
                translated_name="Premium",
                created_at=created,
                updated_at=updated,
            ),
            SimpleNamespace(
                id=11,
                language="en-us",
                translated_name="Premium",
                created_at=created,
                updated_at=updated,
            ),
        ],
    )
    row.created_at = created
    row.updated_at = updated

    repo = FakeLabelRepository(list_result=[row])
    service = LabelService(repository=cast(LabelRepository, repo))
    result = await service.get_label(5001)

    assert result.id == 5001
    assert result.name == "プレミアム"
    assert len(result.akas) == 2
    assert result.akas[0].name == "Premium"
    assert result.akas[0].language == "en-us"
    payload = result.model_dump(by_alias=True)
    assert payload["dmmId"] == "5001"
    assert payload["createdAt"] == created
    assert payload["updatedAt"] == updated


@pytest.mark.asyncio
async def test_get_label_not_found() -> None:
    """Missing label yields HTTP 404."""

    repo = FakeLabelRepository(list_result=[])
    service = LabelService(repository=cast(LabelRepository, repo))

    with pytest.raises(HTTPException) as exc_info:
        await service.get_label(999)

    assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND
