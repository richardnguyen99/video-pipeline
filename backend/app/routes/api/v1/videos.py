"""Video collection and detail endpoints."""

# pylint: disable=too-many-positional-arguments

from typing import List, Optional, cast

from fastapi import APIRouter, BackgroundTasks, Depends, Path, Query, status
from redis.asyncio import Redis
from redis_fastapi import cache, rate_limit

from app.cache.policy import (
    BURST_RATE,
    CACHE_TTL_SECONDS,
    SUSTAIN_RATE,
)
from app.dependencies import (
    AsyncRedisDep,
    CurrentUserDep,
    VideoServiceDep,
    WatchServiceDep,
)
from app.schemas.video import VideoDetailResponse, VideoListResponse
from app.schemas.video_filters import VideoSort
from app.schemas.video_watch import (
    HeartbeatRequest,
    HeartbeatResponse,
    PlayStartRequest,
    PlayStartResponse,
    VideoWatchProgressResponse,
)

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
            "Plus- or space-separated terms matching video code/title/aka/actress "
            "or actress/genre/maker/label/series/director (AND across terms). "
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
    "/videos/watched",
    response_model=VideoListResponse,
    status_code=status.HTTP_200_OK,
    summary="List watched videos for the current user",
    responses={
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Missing or invalid authentication",
        },
    },
)
async def list_watched_videos(
    watch: WatchServiceDep,
    current_user: CurrentUserDep,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> VideoListResponse:
    """Return full video cards for the current user's watch history."""

    return await watch.list_watched_videos(
        user_id=current_user.id,
        limit=limit,
        offset=offset,
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
    locale: Optional[str] = Query(
        default="en-us",
        description="Catalog aka language (e.g. en-us, ja, zh, vi).",
    ),
) -> VideoDetailResponse:
    """Return one video with full relations and detailed actress data."""

    return await service.get_video(video_id=video_id, locale=locale)


@router.get(
    "/videos/{video_id}/recommendations",
    response_model=VideoListResponse,
    status_code=status.HTTP_200_OK,
    summary="List recommended videos for a video",
    responses={
        status.HTTP_404_NOT_FOUND: {
            "description": "Video not found",
        },
    },
    dependencies=[
        Depends(
            cache(
                ttl=CACHE_TTL_SECONDS,
                eviction_group="video_recommendations",
            )
        ),
        Depends(
            rate_limit(
                BURST_RATE,
                scope="video_recommendations:burst",
            )
        ),
        Depends(
            rate_limit(
                SUSTAIN_RATE,
                scope="video_recommendations:sustain",
            )
        ),
    ],
)
async def list_video_recommendations(
    service: VideoServiceDep,
    video_id: int = Path(
        ...,
        ge=1,
        description="Primary key ``Video.id`` of the source video.",
    ),
    limit: int = Query(default=12, ge=1, le=50),
) -> VideoListResponse:
    """Return videos ranked by similarity to the source video.

    Prefers pre-computed ``video_recommendation`` rows; falls back to live
    ranking when none exist (e.g. newly inserted videos). Ranking uses exact
    cast size, shared series/cast, release ±6 months, and catalog overlap.
    Item shape matches ``GET /videos``.
    """

    return await service.list_recommended_videos(
        video_id=video_id,
        limit=limit,
    )


@router.post(
    "/videos/{video_id}/play",
    response_model=PlayStartResponse,
    status_code=status.HTTP_200_OK,
    summary="Start a playback session",
    responses={
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Missing or invalid authentication",
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "Video not found",
        },
    },
)
async def start_video_play(
    watch: WatchServiceDep,
    current_user: CurrentUserDep,
    redis: AsyncRedisDep,
    background_tasks: BackgroundTasks,
    video_id: int = Path(..., ge=1, description="Primary key ``Video.id``."),
    payload: Optional[PlayStartRequest] = None,
) -> PlayStartResponse:
    """Start play: Redis cooldown eligibility + enqueue play_start event.

    The client should send heartbeats about every 10 seconds. A countable
    view is recorded only after the eligible threshold is met.
    """

    body = payload or PlayStartRequest()

    return await watch.start_play(
        video_id,
        user_id=current_user.id,
        redis=cast(Redis, redis),
        background_tasks=background_tasks,
        playback_session_id=body.playback_session_id,
        position_seconds=body.position_seconds,
    )


@router.post(
    "/videos/{video_id}/play/heartbeat",
    response_model=HeartbeatResponse,
    status_code=status.HTTP_200_OK,
    summary="Playback heartbeat (~10s)",
    responses={
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Missing or invalid authentication",
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "Video not found",
        },
    },
)
async def video_play_heartbeat(
    watch: WatchServiceDep,
    current_user: CurrentUserDep,
    redis: AsyncRedisDep,
    background_tasks: BackgroundTasks,
    payload: HeartbeatRequest,
    video_id: int = Path(..., ge=1, description="Primary key ``Video.id``."),
) -> HeartbeatResponse:
    """Enqueue a heartbeat for seek position and watched-time aggregation."""

    return await watch.heartbeat(
        video_id,
        user_id=current_user.id,
        redis=cast(Redis, redis),
        background_tasks=background_tasks,
        playback_session_id=payload.playback_session_id,
        position_seconds=payload.position_seconds,
        watched_seconds_delta=payload.watched_seconds_delta,
    )


@router.get(
    "/videos/{video_id}/watch/progress",
    response_model=VideoWatchProgressResponse,
    status_code=status.HTTP_200_OK,
    summary="Get video seek / resume position",
    responses={
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Missing or invalid authentication",
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "Video not found",
        },
    },
)
async def get_video_watch_progress(
    watch: WatchServiceDep,
    current_user: CurrentUserDep,
    video_id: int = Path(..., ge=1, description="Primary key ``Video.id``."),
) -> VideoWatchProgressResponse:
    """Return the authenticated user's progress for a video (zeros if none)."""

    return await watch.get_progress(
        video_id,
        user_id=current_user.id,
    )
