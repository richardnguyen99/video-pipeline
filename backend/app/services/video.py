"""Video application service."""

# pylint: disable=too-many-locals

from typing import Optional

from fastapi import HTTPException, status

from app.repositories.video import VideoRepository
from app.schemas.video import (
    VideoDetailResponse,
    VideoListResponse,
    VideoResponse,
)
from app.schemas.video_filters import (
    VideoListFilters,
    VideoSort,
    parse_features_cnt,
)


class VideoService:
    """Business operations for video resources."""

    def __init__(self, repository: VideoRepository) -> None:
        """Create a video service.

        Args:
            repository: Video data-access collaborator.
        """

        self._repository = repository

    async def list_videos(
        self,
        *,
        limit: int = 20,
        offset: int = 0,
        page: Optional[int] = None,
        sort: Optional[VideoSort] = None,
        actress: Optional[list[int]] = None,
        genre: Optional[list[int]] = None,
        maker: Optional[int] = None,
        label: Optional[int] = None,
        director: Optional[int] = None,
        series: Optional[int] = None,
        features_cnt: Optional[str] = None,
    ) -> VideoListResponse:
        """List videos with discover filters and pagination.

        Multi-value filters use OR semantics within each id list
        (``?actress=1&actress=2`` matches videos featuring either).

        Args:
            limit: Page size (clamped to at least 1).
            offset: Rows to skip when ``page`` is not provided.
            page: 1-based page index; overrides ``offset`` when set.
            sort: Discover sort key.
            actress: Actress primary keys (repeated query keys).
            genre: Genre primary keys (repeated query keys).
            maker: Single maker id.
            label: Single label id.
            director: Single director id.
            series: Single series id.
            features_cnt: Raw range string (``2``, ``3,``, ``1,3``).

        Returns:
            A ``VideoListResponse`` with items and totals.

        Raises:
            HTTPException: 400 when ``features_cnt`` is invalid.
        """

        safe_limit = max(1, limit)
        features_range = None

        if features_cnt is not None and features_cnt.strip() != "":
            try:
                features_range = parse_features_cnt(features_cnt)
            except ValueError as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=str(exc),
                ) from exc

        filters = VideoListFilters(
            actress=list(actress or []),
            genre=list(genre or []),
            maker=maker,
            label=label,
            director=director,
            series=series,
            features_cnt=features_range,
            sort=sort or VideoSort.TRENDING_WEEK,
        )

        if page is not None:
            safe_page = max(1, page)
            safe_offset = (safe_page - 1) * safe_limit
        else:
            safe_offset = max(0, offset)

        rows = await self._repository.list_videos(
            filters=filters,
            limit=safe_limit,
            offset=safe_offset,
        )
        total = await self._repository.count_videos(filters=filters)
        items = [VideoResponse.model_validate(row) for row in rows]

        return VideoListResponse(
            items=items,
            total=total,
            limit=safe_limit,
            offset=safe_offset,
        )

    async def get_video(self, video_id: int) -> VideoDetailResponse:
        """Return a single video by primary key with full relations.

        Args:
            video_id: ``Video.id`` primary key.

        Returns:
            A ``VideoDetailResponse`` including actress aka and images.

        Raises:
            HTTPException: When no video exists for ``video_id``.
        """

        row = await self._repository.get_by_id(video_id)

        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Video not found",
            )

        return VideoDetailResponse.model_validate(row)
