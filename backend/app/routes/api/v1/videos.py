"""Video collection endpoints."""

from fastapi import APIRouter, Query, status

from app.dependencies import VideoServiceDep
from app.schemas.video import VideoListResponse

router = APIRouter()


@router.get(
    "/videos",
    response_model=VideoListResponse,
    status_code=status.HTTP_200_OK,
    summary="List videos",
)
async def list_videos(
    service: VideoServiceDep,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> VideoListResponse:
    """Return a paginated list of videos with related entities."""

    return await service.list_videos(limit=limit, offset=offset)
