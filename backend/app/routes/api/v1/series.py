"""Series collection endpoints."""

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from redis_fastapi import cache, rate_limit

from app.cache.policy import (
    BURST_RATE,
    CACHE_TTL_SECONDS,
    SUSTAIN_RATE,
)
from app.dependencies import SeriesServiceDep
from app.schemas.series import SeriesDetailResponse, SeriesListResponse

router = APIRouter()


@router.get(
    "/series",
    response_model=SeriesListResponse,
    status_code=status.HTTP_200_OK,
    summary="List series",
    dependencies=[
        Depends(
            cache(ttl=CACHE_TTL_SECONDS, eviction_group="series_list"),
        ),
        Depends(
            rate_limit(
                BURST_RATE,
                scope="series_list:burst",
            ),
        ),
        Depends(
            rate_limit(
                SUSTAIN_RATE,
                scope="series_list:sustain",
            ),
        ),
    ],
)
async def list_series(
    service: SeriesServiceDep,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    locale: Optional[str] = Query(
        default=None,
        description=(
            "When set, ``name`` uses ``series_aka.translated_name`` for this "
            "language and aka search is scoped to it. When omitted, "
            "``name`` is native Japanese ``series.name``."
        ),
    ),
    q: Optional[str] = Query(
        default=None,
        description=(
            "Space-separated search terms (AND). Matches series name, ruby, "
            "and aka translated_name. With ``locale``, aka matches are "
            "limited to that language."
        ),
    ),
) -> SeriesListResponse:
    """Return a paginated list of series."""

    return await service.list_series(
        locale=locale,
        q=q,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/series/{series_id}",
    response_model=SeriesDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get series",
    dependencies=[
        Depends(
            cache(ttl=CACHE_TTL_SECONDS, eviction_group="series_detail"),
        ),
        Depends(
            rate_limit(
                BURST_RATE,
                scope="series_detail:burst",
            ),
        ),
        Depends(
            rate_limit(
                SUSTAIN_RATE,
                scope="series_detail:sustain",
            ),
        ),
    ],
)
async def get_series(
    series_id: int,
    service: SeriesServiceDep,
) -> SeriesDetailResponse:
    """Return one series with native Japanese name and all akas."""

    return await service.get_series(series_id)
