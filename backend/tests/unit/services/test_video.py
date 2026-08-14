"""Unit tests for ``app.services.video.VideoService``."""

from __future__ import annotations

from dataclasses import dataclass, field
from types import SimpleNamespace
from typing import Any, cast

import pytest
from fastapi import HTTPException, status

from app.repositories.video import VideoRepository
from app.services.video import VideoService


@dataclass
class FakeVideoRepository:
    """In-memory stand-in for ``VideoRepository``."""

    list_result: list[Any] = field(default_factory=list)
    count_result: int = 0
    list_calls: list[dict[str, int]] = field(default_factory=list)
    count_calls: int = 0
    get_result: Any | None = None
    get_calls: list[int] = field(default_factory=list)

    async def list_videos(
        self,
        *,
        limit: int = 20,
        offset: int = 0,
    ) -> list[Any]:
        """Return configured list rows and record the call."""

        self.list_calls.append({"limit": limit, "offset": offset})

        return list(self.list_result)

    async def count_videos(self) -> int:
        """Return the configured total and record the call."""

        self.count_calls += 1

        return self.count_result

    async def get_by_id(self, video_id: int) -> Any | None:
        """Return the configured detail row and record the call."""

        self.get_calls.append(video_id)

        return self.get_result


@pytest.fixture
def repository() -> FakeVideoRepository:
    """Fresh fake repository per test."""

    return FakeVideoRepository()


@pytest.fixture
def service(repository: FakeVideoRepository) -> VideoService:
    """``VideoService`` wired to the fake repository."""

    return VideoService(repository=cast(VideoRepository, repository))


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
    assert repository.list_calls == [{"limit": 20, "offset": 0}]
    assert repository.count_calls == 1


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


@pytest.mark.asyncio
async def test_list_videos_includes_m2m_and_media_relations(
    service: VideoService,
    repository: FakeVideoRepository,
) -> None:
    """Many-to-many catalog links and one-to-many media URLs are included."""

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
        actresses=[
            SimpleNamespace(
                id=1,
                name="Aoi Sora",
                ruby=None,
                image_url="https://example.com/a.jpg",
            ),
        ],
        genres=[
            SimpleNamespace(id=2, name="Drama", ruby=None, dmm_id="g-1"),
        ],
        series=[
            SimpleNamespace(id=3, name="Series A", ruby=None, dmm_id="s-1"),
        ],
        makers=[
            SimpleNamespace(id=4, name="Maker A", ruby=None, dmm_id="m-1"),
        ],
        labels=[
            SimpleNamespace(id=5, name="Label A", ruby=None, dmm_id="l-1"),
        ],
        directors=[
            SimpleNamespace(id=6, name="Director A", ruby=None, dmm_id="d-1"),
        ],
        video_image_url=[
            SimpleNamespace(
                id=10, url="https://example.com/cover.jpg", type="cover"
            ),
        ],
        video_sample_image_url=[
            SimpleNamespace(
                id=11, url="https://example.com/s1.jpg", type="sample"
            ),
        ],
        video_sample_movie_url=[
            SimpleNamespace(
                id=12, url="https://example.com/s.mp4", type="mp4"
            ),
        ],
    )
    repository.list_result = [row]
    repository.count_result = 1

    result = await service.list_videos()
    item = result.items[0]

    assert item.actresses[0].name == "Aoi Sora"
    assert item.actresses[0].image_url == "https://example.com/a.jpg"
    assert item.genres[0].name == "Drama"
    assert item.series[0].name == "Series A"
    assert item.makers[0].name == "Maker A"
    assert item.labels[0].name == "Label A"
    assert item.directors[0].name == "Director A"
    assert item.video_image_url[0].url == "https://example.com/cover.jpg"
    assert item.video_sample_image_url[0].url == "https://example.com/s1.jpg"
    assert item.video_sample_movie_url[0].url == "https://example.com/s.mp4"
    assert "fk_id" not in item.video_image_url[0].model_fields


@pytest.mark.asyncio
async def test_list_videos_clamps_non_positive_limit(
    service: VideoService,
    repository: FakeVideoRepository,
) -> None:
    """Non-positive limit is clamped to 1 before hitting the repository."""

    await service.list_videos(limit=0, offset=-3)

    assert repository.list_calls == [{"limit": 1, "offset": 0}]


@pytest.mark.asyncio
async def test_list_videos_preserves_requested_pagination(
    service: VideoService,
    repository: FakeVideoRepository,
) -> None:
    """Positive limit/offset are forwarded and echoed in the response."""

    repository.count_result = 50

    result = await service.list_videos(limit=5, offset=10)

    assert result.limit == 5
    assert result.offset == 10
    assert result.total == 50
    assert repository.list_calls == [{"limit": 5, "offset": 10}]


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
    assert result.video_id == "SSIS-007"
    assert result.actresses[0].actress_aka is not None
    assert result.actresses[0].actress_aka.translated_name == "Aoi Sora"
    assert result.actresses[0].actress_image[0].attribute == "avatar"
    assert result.genres[0].name == "Drama"
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
