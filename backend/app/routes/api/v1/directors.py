"""Director collection endpoints."""

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from redis_fastapi import cache, rate_limit

from app.cache.policy import (
    BURST_RATE,
    CACHE_TTL_SECONDS,
    SUSTAIN_RATE,
)
from app.dependencies import DirectorServiceDep
from app.schemas.director import DirectorDetailResponse, DirectorListResponse

router = APIRouter()


@router.get(
    "/directors",
    response_model=DirectorListResponse,
    status_code=status.HTTP_200_OK,
    summary="List directors",
    dependencies=[
        Depends(
            cache(ttl=CACHE_TTL_SECONDS, eviction_group="director_list"),
        ),
        Depends(
            rate_limit(
                BURST_RATE,
                scope="director_list:burst",
            ),
        ),
        Depends(
            rate_limit(
                SUSTAIN_RATE,
                scope="director_list:sustain",
            ),
        ),
    ],
)
async def list_directors(
    service: DirectorServiceDep,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    locale: Optional[str] = Query(
        default=None,
        description=(
            "When set, ``name`` uses ``director_aka.translated_name`` for "
            "this language and aka search is scoped to it. When omitted, "
            "``name`` is native Japanese ``director.name``."
        ),
    ),
    q: Optional[str] = Query(
        default=None,
        description=(
            "Space-separated search terms (AND). Matches director name, "
            "ruby, and aka translated_name. With ``locale``, aka matches "
            "are limited to that language."
        ),
    ),
) -> DirectorListResponse:
    """Return a paginated list of directors."""

    return await service.list_directors(
        locale=locale,
        q=q,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/directors/{director_id}",
    response_model=DirectorDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get director",
    dependencies=[
        Depends(
            cache(ttl=CACHE_TTL_SECONDS, eviction_group="director_detail"),
        ),
        Depends(
            rate_limit(
                BURST_RATE,
                scope="director_detail:burst",
            ),
        ),
        Depends(
            rate_limit(
                SUSTAIN_RATE,
                scope="director_detail:sustain",
            ),
        ),
    ],
)
async def get_director(
    director_id: int,
    service: DirectorServiceDep,
) -> DirectorDetailResponse:
    """Return one director with native Japanese name and all akas."""

    return await service.get_director(director_id)
