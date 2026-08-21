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
    list_calls: list[dict[str, Any]] = field(default_factory=list)
    count_calls: int = 0
    engagement_result: dict[int, dict[str, int]] = field(
        default_factory=dict,
    )
    engagement_calls: list[list[int]] = field(default_factory=list)

    async def list_actresses(
        self,
        *,
        filters: Any = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[Any]:
        """Return configured list rows and record the call."""

        self.list_calls.append(
            {
                "filters": filters,
                "limit": limit,
                "offset": offset,
            },
        )

        return list(self.list_result)

    async def count_actresses(self, *, filters: Any = None) -> int:
        """Return the configured total and record the call."""

        self.count_calls += 1

        return self.count_result

    async def count_engagement_for_actresses(
        self,
        actress_ids: list[int],
    ) -> dict[int, dict[str, int]]:
        """Return configured engagement counts (zeros when missing)."""

        self.engagement_calls.append(list(actress_ids))

        return {
            actress_id: dict(
                self.engagement_result.get(
                    actress_id,
                    {
                        "video_cnt": 0,
                        "sub_cnt": 0,
                        "view_cnt": 0,
                    },
                ),
            )
            for actress_id in actress_ids
        }


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
    assert repository.list_calls[0]["limit"] == 20
    assert repository.list_calls[0]["offset"] == 0
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
    assert result.items[0].aka is None
    assert result.items[0].image == []
    assert result.items[0].video_cnt == 0
    assert result.items[0].sub_cnt == 0
    assert result.items[0].view_cnt == 0


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

    assert result.items[0].aka is not None
    assert result.items[0].aka.translated_name == "Aoi Sora"
    assert "name" not in result.items[0].aka.model_fields
    assert "name_type" not in result.items[0].aka.model_fields
    assert "fk_id" not in result.items[0].aka.model_fields
    assert len(result.items[0].image) == 1
    assert result.items[0].image[0].url == "https://example.com/img.jpg"
    assert result.items[0].image[0].attribute == "default"
    assert "fk_id" not in result.items[0].image[0].model_fields


@pytest.mark.asyncio
async def test_list_actresses_clamps_non_positive_limit(
    service: ActressService,
    repository: FakeActressRepository,
) -> None:
    """Non-positive limit is clamped to 1 before hitting the repository."""

    await service.list_actresses(limit=0, offset=-5)

    assert repository.list_calls[0]["limit"] == 1
    assert repository.list_calls[0]["offset"] == 0


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
    assert repository.list_calls[0]["limit"] == 5
    assert repository.list_calls[0]["offset"] == 15


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

    labels = [img.attribute for img in result.items[0].image]
    assert labels == ["thumbnail", "default", "avatar", "thumbnail"]


@pytest.mark.asyncio
async def test_list_actresses_attaches_engagement_counts(
    service: ActressService,
    repository: FakeActressRepository,
) -> None:
    """Non-zero repository engagement totals are attached to each item."""

    repository.list_result = [
        SimpleNamespace(
            id=1,
            name="A",
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
            actress_image=[],
        ),
        SimpleNamespace(
            id=2,
            name="B",
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
            actress_image=[],
        ),
    ]
    repository.count_result = 2
    repository.engagement_result = {
        1: {"video_cnt": 12, "sub_cnt": 4, "view_cnt": 900},
        2: {"video_cnt": 1, "sub_cnt": 0, "view_cnt": 15},
    }

    result = await service.list_actresses()

    assert repository.engagement_calls == [[1, 2]]
    assert result.items[0].video_cnt == 12
    assert result.items[0].sub_cnt == 4
    assert result.items[0].view_cnt == 900
    assert result.items[1].video_cnt == 1
    assert result.items[1].sub_cnt == 0
    assert result.items[1].view_cnt == 15


@pytest.mark.asyncio
async def test_list_actresses_engagement_defaults_when_repo_omits_id(
    service: ActressService,
    repository: FakeActressRepository,
) -> None:
    """Missing engagement entry for an id becomes zeros on the response."""

    repository.list_result = [
        SimpleNamespace(
            id=9,
            name="Solo",
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
            actress_image=[],
        ),
    ]
    repository.count_result = 1
    repository.engagement_result = {}

    result = await service.list_actresses()

    assert result.items[0].video_cnt == 0
    assert result.items[0].sub_cnt == 0
    assert result.items[0].view_cnt == 0
