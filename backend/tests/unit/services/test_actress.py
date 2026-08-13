"""Unit tests for ``app.services.actress.ActressService``."""

from __future__ import annotations

from dataclasses import dataclass, field
from types import SimpleNamespace
from typing import Any, cast

import pytest

from app.repositories.actress import ActressRepository
from app.services.actress import ActressService


@dataclass
class FakeActressRepository:
    """In-memory stand-in for ``ActressRepository`` with real async methods.

    Prefer this over ``AsyncMock`` so editors and type checkers see concrete
    signatures for ``list_actresses`` / ``count_actresses``.
    """

    list_result: list[Any] = field(default_factory=list)
    count_result: int = 0
    list_calls: list[dict[str, int]] = field(default_factory=list)
    count_calls: int = 0

    async def list_actresses(
        self,
        *,
        limit: int = 20,
        offset: int = 0,
    ) -> list[Any]:
        """Return configured list rows and record the call."""

        self.list_calls.append({"limit": limit, "offset": offset})

        return list(self.list_result)

    async def count_actresses(self) -> int:
        """Return the configured total and record the call."""

        self.count_calls += 1

        return self.count_result


@pytest.fixture
def repository() -> FakeActressRepository:
    """Fresh fake repository per test."""

    return FakeActressRepository()


@pytest.fixture
def service(repository: FakeActressRepository) -> ActressService:
    """``ActressService`` wired to the fake repository."""

    return ActressService(
        repository=cast(ActressRepository, repository),
    )


@pytest.mark.asyncio
async def test_list_actresses_returns_empty_items(
    service: ActressService,
    repository: FakeActressRepository,
) -> None:
    """Empty repository yields an empty item list and zero total."""

    result = await service.list_actresses()

    assert result.items == []
    assert result.total == 0
    assert result.limit == 20
    assert result.offset == 0
    assert repository.list_calls == [{"limit": 20, "offset": 0}]
    assert repository.count_calls == 1


@pytest.mark.asyncio
async def test_list_actresses_maps_repository_rows(
    service: ActressService,
    repository: FakeActressRepository,
) -> None:
    """Repository rows are mapped into ``ActressResponse`` items."""

    row = SimpleNamespace(
        id=1,
        name="Aoi Tsukasa",
        ruby="あおい つかさ",
        image_url="https://example.com/a.jpg",
        dmm_id="dmm-1",
        bust=90,
        cup="F",
        waist=59,
        hip=89,
        height=163,
        birthday="1990-08-14",
        created_at=None,
        updated_at=None,
        actress_aka=None,
        actress_image=[],
    )
    repository.list_result = [row]
    repository.count_result = 1

    result = await service.list_actresses(limit=10, offset=0)

    assert result.total == 1
    assert len(result.items) == 1
    assert result.items[0].id == 1
    assert result.items[0].name == "Aoi Tsukasa"
    assert result.items[0].ruby == "あおい つかさ"
    assert result.items[0].actress_aka is None
    assert result.items[0].actress_image == []


@pytest.mark.asyncio
async def test_list_actresses_includes_aka_and_images(
    service: ActressService,
    repository: FakeActressRepository,
) -> None:
    """Aka and image relations are included in the response."""

    aka = SimpleNamespace(
        id=10,
        name="蒼井そら",
        translated_name="Aoi Sora",
        name_type="ja",
        fk_id=1,
    )
    image = SimpleNamespace(
        id=20,
        url="https://example.com/img.jpg",
        attribute=1,
        fk_id=1,
    )
    row = SimpleNamespace(
        id=1,
        name="Aoi Sora",
        ruby=None,
        image_url=None,
        dmm_id="dmm-1",
        bust=None,
        cup=None,
        waist=None,
        hip=None,
        height=None,
        birthday=None,
        created_at=None,
        updated_at=None,
        actress_aka=aka,
        actress_image=[image],
    )
    repository.list_result = [row]
    repository.count_result = 1

    result = await service.list_actresses()

    assert result.items[0].actress_aka is not None
    assert result.items[0].actress_aka.translated_name == "Aoi Sora"
    assert "name_type" not in result.items[0].actress_aka.model_fields
    assert "fk_id" not in result.items[0].actress_aka.model_fields
    assert len(result.items[0].actress_image) == 1
    assert (
        result.items[0].actress_image[0].url == "https://example.com/img.jpg"
    )
    assert result.items[0].actress_image[0].attribute == "thumbnail"
    assert "fk_id" not in result.items[0].actress_image[0].model_fields


@pytest.mark.asyncio
async def test_list_actresses_clamps_non_positive_limit(
    service: ActressService,
    repository: FakeActressRepository,
) -> None:
    """Non-positive limit is clamped to 1 before hitting the repository."""

    await service.list_actresses(limit=0, offset=-5)

    assert repository.list_calls == [{"limit": 1, "offset": 0}]


@pytest.mark.asyncio
async def test_list_actresses_preserves_requested_pagination(
    service: ActressService,
    repository: FakeActressRepository,
) -> None:
    """Positive limit/offset are forwarded and echoed in the response."""

    repository.count_result = 100

    result = await service.list_actresses(limit=5, offset=15)

    assert result.limit == 5
    assert result.offset == 15
    assert result.total == 100
    assert repository.list_calls == [{"limit": 5, "offset": 15}]


@pytest.mark.asyncio
async def test_list_actresses_maps_image_attribute_codes(
    service: ActressService,
    repository: FakeActressRepository,
) -> None:
    """Numeric image attribute codes become readable labels."""

    images = [
        SimpleNamespace(
            id=1,
            url="https://example.com/0.jpg",
            attribute=0,
            fk_id=1,
        ),
        SimpleNamespace(
            id=2,
            url="https://example.com/1.jpg",
            attribute=1,
            fk_id=1,
        ),
        SimpleNamespace(
            id=3,
            url="https://example.com/2.jpg",
            attribute=2,
            fk_id=1,
        ),
        SimpleNamespace(
            id=4,
            url="https://example.com/9.jpg",
            attribute=99,
            fk_id=1,
        ),
    ]
    row = SimpleNamespace(
        id=1,
        name="Test",
        ruby=None,
        image_url=None,
        dmm_id=None,
        bust=None,
        cup=None,
        waist=None,
        hip=None,
        height=None,
        birthday=None,
        created_at=None,
        updated_at=None,
        actress_aka=None,
        actress_image=images,
    )
    repository.list_result = [row]
    repository.count_result = 1

    result = await service.list_actresses()

    labels = [img.attribute for img in result.items[0].actress_image]
    assert labels == ["fallback", "thumbnail", "avatar", "fallback"]
