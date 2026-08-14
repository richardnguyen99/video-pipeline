"""Video application service."""

from fastapi import HTTPException, status

from app.repositories.video import VideoRepository
from app.schemas.video import (
    VideoDetailResponse,
    VideoListResponse,
    VideoResponse,
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
    ) -> VideoListResponse:
        """List videos with simple offset pagination.

        Args:
            limit: Page size (clamped to at least 1).
            offset: Rows to skip (clamped to at least 0).

        Returns:
            A ``VideoListResponse`` with items and totals.
        """

        safe_limit = max(1, limit)
        safe_offset = max(0, offset)

        rows = await self._repository.list_videos(
            limit=safe_limit,
            offset=safe_offset,
        )
        total = await self._repository.count_videos()

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
