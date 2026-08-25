"""Video collection and detail endpoints."""

# pylint: disable=too-many-positional-arguments

from typing import List, Optional

from fastapi import APIRouter, Depends, Path, Query, status
from redis_fastapi import cache, rate_limit

from app.cache.policy import (
    BURST_RATE,
    CACHE_TTL_SECONDS,
    SUSTAIN_RATE,
)
from app.dependencies import VideoServiceDep
from app.schemas.video import VideoDetailResponse, VideoListResponse
from app.schemas.video_filters import VideoSort

router = APIRouter()


@router.get(
    "/videos",
    response_model=VideoListResponse,
    status_code=status.HTTP_200_OK,
    summary="List videos",
    dependencies=[
        Depends(
            cache(
                ttl=CACHE_TTL_SECONDS,
                eviction_group="video_list",
            ),
        ),
        Depends(
            rate_limit(
                BURST_RATE,
                scope="video_list:burst",
            ),
        ),
        Depends(
            rate_limit(
                SUSTAIN_RATE,
                scope="video_list:sustain",
            ),
        ),
    ],
)
async def list_videos(
    service: VideoServiceDep,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    page: Optional[int] = Query(default=None, ge=1),
    sort: Optional[VideoSort] = Query(default=None),
    actress: Optional[List[int]] = Query(
        default=None,
        description="Repeated actress ids: ?actress=1&actress=2 (OR).",
    ),
    genre: Optional[List[int]] = Query(
        default=None,
        description="Repeated genre ids: ?genre=1&genre=2 (OR).",
    ),
    maker: Optional[int] = Query(default=None, ge=1),
    label: Optional[int] = Query(default=None, ge=1),
    director: Optional[int] = Query(default=None, ge=1),
    series: Optional[int] = Query(default=None, ge=1),
    features_cnt: Optional[str] = Query(
        default=None,
        description='Actress count range: "2", "3,", or "1,3".',
    ),
    q: Optional[str] = Query(
        default=None,
        description=(
            "Plus- or space-separated terms matching video code/title/aka "
            "or genre/maker/label/series/director (AND across terms). "
            "Example: MIRD+squirt"
        ),
    ),
    locale: Optional[str] = Query(
        default="en-us",
        description="Catalog aka language (e.g. en-us, ja, zh)",
    ),
) -> VideoListResponse:
    """Return a paginated, filtered list of videos."""

    return await service.list_videos(
        limit=limit,
        offset=offset,
        page=page,
        sort=sort,
        actress=actress,
        genre=genre,
        maker=maker,
        label=label,
        director=director,
        series=series,
        features_cnt=features_cnt,
        q=q,
        locale=locale,
    )


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
    dependencies=[
        Depends(
            cache(
                ttl=CACHE_TTL_SECONDS,
                eviction_group="video_detail",
            )
        ),
        Depends(
            rate_limit(
                BURST_RATE,
                scope="video_detail:burst",
            )
        ),
        Depends(
            rate_limit(
                SUSTAIN_RATE,
                scope="video_detail:sustain",
            )
        ),
    ],
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
