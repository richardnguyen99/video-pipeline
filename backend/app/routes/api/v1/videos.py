"""Video collection and detail endpoints."""

from fastapi import APIRouter, Path, Query, status

from app.dependencies import VideoServiceDep
from app.schemas.video import VideoDetailResponse, VideoListResponse

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


@router.get(
    "/videos/{video_id}",
    response_model=VideoDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get video by id",
    responses={
        status.HTTP_404_NOT_FOUND: {
            "description": "Video not found",
        },
    },
)
async def get_video(
    service: VideoServiceDep,
    video_id: int = Path(
        ...,
        ge=1,
        description="Primary key ``Video.id`` (not the string code).",
    ),
) -> VideoDetailResponse:
    """Return one video with full relations and detailed actress data."""

    return await service.get_video(video_id=video_id)
