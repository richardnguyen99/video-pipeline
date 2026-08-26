"""Unit tests for ``app.services.video.VideoService``."""

from __future__ import annotations

from dataclasses import dataclass, field
from types import SimpleNamespace
from typing import Any, Optional, cast

import pytest
from fastapi import HTTPException, status

from app.repositories.video import VideoRepository
from app.schemas.video import VideoEngagementCounts
from app.schemas.video_filters import (
    VideoListFilters,
    VideoSort,
    parse_features_cnt,
)
from app.services.video import VideoService


@dataclass
class FakeVideoRepository:
    """In-memory stand-in for ``VideoRepository``."""

    list_result: list[Any] = field(default_factory=list)
    count_result: int = 0
    list_calls: list[dict[str, Any]] = field(default_factory=list)
    count_calls: list[dict[str, Any]] = field(default_factory=list)
    get_result: Any | None = None
    get_calls: list[int] = field(default_factory=list)

    async def list_videos(
        self,
        *,
        filters: Optional[VideoListFilters] = None,
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

    async def count_videos(
        self,
        *,
        filters: Optional[VideoListFilters] = None,
    ) -> int:
        """Return the configured total and record the call."""

        self.count_calls.append({"filters": filters})

        return self.count_result

    async def list_and_count_videos(
        self,
        *,
        filters: Optional[VideoListFilters] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[Any], int]:
        """Return configured rows and total with a single recorded list call."""

        rows = await self.list_videos(
            filters=filters,
            limit=limit,
            offset=offset,
        )
        total = await self.count_videos(filters=filters)

        return rows, total

    async def get_by_id(self, video_id: int) -> Any | None:
        """Return the configured detail row and record the call."""

        self.get_calls.append(video_id)

        return self.get_result

    async def count_engagement_for_videos(
        self,
        video_ids: list[int],
    ) -> dict[int, Any]:
        """Return empty engagement totals for each id."""

        return {video_id: VideoEngagementCounts() for video_id in video_ids}

    async def list_comments_for_video(
        self,
        video_id: int,  # pylint: disable=unused-argument
    ) -> list[Any]:
        """Return no comments by default."""

        return []

    async def get_master_m3u8_url(
        self,
        video_id: int,  # pylint: disable=unused-argument
    ) -> str | None:
        """Return no master playlist by default."""

        return None


@pytest.fixture
def repository() -> FakeVideoRepository:
    """Fresh fake repository per test."""

    return FakeVideoRepository()


@pytest.fixture
def service(
    repository: FakeVideoRepository,
) -> VideoService:
    """Service under test with a fake repository."""

    return VideoService(
        repository=cast(VideoRepository, repository),
    )


def test_parse_features_cnt_exact() -> None:
    """``2`` means exactly two featured actresses."""

    result = parse_features_cnt("2")

    assert result.min == 2
    assert result.max == 2


def test_parse_features_cnt_open_ended() -> None:
    """``3,`` means three or more featured actresses."""

    result = parse_features_cnt("3,")

    assert result.min == 3
    assert result.max is None


def test_parse_features_cnt_range() -> None:
    """``1,3`` means between one and three featured actresses."""

    result = parse_features_cnt("1,3")

    assert result.min == 1
    assert result.max == 3


def test_parse_features_cnt_invalid() -> None:
    """Malformed strings raise ``ValueError``."""

    with pytest.raises(ValueError):
        parse_features_cnt(",")


@pytest.mark.asyncio
async def test_list_videos_returns_empty_items(
    service: VideoService,
    repository: FakeVideoRepository,
) -> None:
    """Empty repository yields an empty item list and zero total."""

    result = await service.list_videos()

    assert result.items == []
    assert result.total == 0
    assert result.limit == 20
    assert result.offset == 0
    assert len(repository.list_calls) == 1
    assert repository.list_calls[0]["limit"] == 20
    assert repository.list_calls[0]["offset"] == 0
    assert len(repository.count_calls) == 1


@pytest.mark.asyncio
async def test_list_videos_maps_core_fields(
    service: VideoService,
    repository: FakeVideoRepository,
) -> None:
    """Core video fields are mapped into ``VideoResponse``."""

    row = SimpleNamespace(
        id=1,
        video_id="SSIS-001",
        title="Sample Title",
        cid="cid-1",
        duration=120,
        release_date=None,
        jancode=None,
        maker_product=None,
        floor_code=None,
        created_at=None,
        updated_at=None,
        actresses=[],
        genres=[],
        series=[],
        makers=[],
        labels=[],
        directors=[],
        video_image_url=[],
        video_sample_image_url=[],
        video_sample_movie_url=[],
    )
    repository.list_result = [row]
    repository.count_result = 1

    result = await service.list_videos(limit=10, offset=0)

    assert result.total == 1
    assert result.items[0].video_id == "SSIS-001"
    assert result.items[0].title == "Sample Title"
    assert result.items[0].duration == 120
    assert result.items[0].views == 0
    assert result.items[0].likes == 0
    assert result.items[0].dislikes == 0
    assert result.items[0].comments == 0


@pytest.mark.asyncio
async def test_list_videos_forwards_filters(
    service: VideoService,
    repository: FakeVideoRepository,
) -> None:
    """Discover query params are normalized into ``VideoListFilters``."""

    await service.list_videos(
        limit=16,
        page=2,
        sort=VideoSort.LATEST,
        actress=[1, 2],
        genre=[3],
        maker=4,
        label=5,
        director=6,
        series=7,
        features_cnt="1,3",
    )

    call = repository.list_calls[0]
    filters = call["filters"]

    assert call["limit"] == 16
    assert call["offset"] == 16
    assert filters is not None
    assert filters.sort == VideoSort.LATEST
    assert filters.actress == [1, 2]
    assert filters.genre == [3]
    assert filters.maker == 4
    assert filters.label == 5
    assert filters.director == 6
    assert filters.series == 7
    assert filters.features_cnt is not None
    assert filters.features_cnt.min == 1
    assert filters.features_cnt.max == 3


@pytest.mark.asyncio
async def test_list_videos_invalid_features_cnt_raises_401(
    service: VideoService,
) -> None:
    """Invalid ``features_cnt`` yields HTTP 400."""

    with pytest.raises(HTTPException) as exc_info:
        await service.list_videos(features_cnt=",")

    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.asyncio
async def test_list_videos_clamps_non_positive_limit(
    service: VideoService,
    repository: FakeVideoRepository,
) -> None:
    """Non-positive limit is clamped to 1 before hitting the repository."""

    await service.list_videos(limit=0, offset=-3)

    assert repository.list_calls[0]["limit"] == 1
    assert repository.list_calls[0]["offset"] == 0


@pytest.mark.asyncio
async def test_list_videos_omits_nested_relations(
    service: VideoService,
    repository: FakeVideoRepository,
) -> None:
    """List items omit catalog relations; thumbnail images are allowed."""

    row = SimpleNamespace(
        id=1,
        video_id="SSIS-001",
        title="Sample",
        cid=None,
        duration=None,
        release_date=None,
        jancode=None,
        maker_product=None,
        floor_code=None,
        created_at=None,
        updated_at=None,
        actresses=[{"id": 1, "name": "ignored"}],
        genres=[{"id": 2, "name": "ignored"}],
        video_image_url=[],
    )
    repository.list_result = [row]
    repository.count_result = 1

    result = await service.list_videos()
    item = result.items[0]
    payload = item.model_dump()

    assert item.video_id == "SSIS-001"
    assert "actresses" not in payload
    assert "genres" not in payload
    assert "makers" not in payload
    assert "labels" not in payload
    assert "directors" not in payload
    assert "series" not in payload
    assert "video_sample_image_url" not in payload
    assert "video_sample_movie_url" not in payload
    assert "video_image_url" in payload
    assert payload["video_image_url"] == []


@pytest.mark.asyncio
async def test_get_video_returns_detail_with_actress_relations(
    service: VideoService,
    repository: FakeVideoRepository,
) -> None:
    """Detail payload includes actress aka and images."""

    repository.get_result = SimpleNamespace(
        id=7,
        video_id="SSIS-007",
        title="Detail Title",
        cid=None,
        duration=90,
        release_date=None,
        jancode=None,
        maker_product=None,
        floor_code=None,
        created_at=None,
        updated_at=None,
        actresses=[
            SimpleNamespace(
                id=1,
                name="Aoi Sora",
                ruby=None,
                image_url="https://example.com/a.jpg",
                dmm_id="dmm-1",
                actress_aka=SimpleNamespace(
                    id=10,
                    name="蒼井そら",
                    translated_name="Aoi Sora",
                ),
                actress_image=[
                    SimpleNamespace(
                        id=20,
                        url="https://example.com/avatar.jpg",
                        attribute=2,
                    ),
                ],
            ),
        ],
        genres=[
            SimpleNamespace(id=2, name="Drama", ruby=None, dmm_id="g-1"),
        ],
        series=[],
        makers=[],
        labels=[],
        directors=[],
        video_image_url=[
            SimpleNamespace(
                id=10,
                url="https://example.com/cover.jpg",
                type="cover",
            ),
        ],
        video_sample_image_url=[],
        video_sample_movie_url=[],
    )

    result = await service.get_video(video_id=7)

    assert result.id == 7
    assert result.actresses[0].actress_aka is not None
    assert result.actresses[0].actress_image[0].attribute == "avatar"
    assert repository.get_calls == [7]


@pytest.mark.asyncio
async def test_get_video_raises_not_found_when_missing(
    service: VideoService,
    repository: FakeVideoRepository,
) -> None:
    """Missing primary key yields HTTP 404."""

    repository.get_result = None

    with pytest.raises(HTTPException) as exc_info:
        await service.get_video(video_id=999)

    assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND
    assert repository.get_calls == [999]
