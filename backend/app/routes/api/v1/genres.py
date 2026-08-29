"""Genre collection endpoints."""

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from redis_fastapi import cache, rate_limit

from app.cache.policy import (
    BURST_RATE,
    CACHE_TTL_SECONDS,
    SUSTAIN_RATE,
)
from app.dependencies import GenreServiceDep
from app.schemas.genre import GenreDetailResponse, GenreListResponse

router = APIRouter()


@router.get(
    "/genres",
    response_model=GenreListResponse,
    status_code=status.HTTP_200_OK,
    summary="List genres",
    dependencies=[
        Depends(
            cache(ttl=CACHE_TTL_SECONDS, eviction_group="genre_list"),
        ),
        Depends(
            rate_limit(
                BURST_RATE,
                scope="genre_list:burst",
            ),
        ),
        Depends(
            rate_limit(
                SUSTAIN_RATE,
                scope="genre_list:sustain",
            ),
        ),
    ],
)
async def list_genres(
    service: GenreServiceDep,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    locale: Optional[str] = Query(
        default=None,
        description=(
            "When set, ``name`` uses ``genre_aka.translated_name`` for this "
            "language and aka search is scoped to it. When omitted, "
            "``name`` is native Japanese ``genre.name``."
        ),
    ),
    q: Optional[str] = Query(
        default=None,
        description=(
            "Space-separated search terms (AND). Matches genre name, ruby, "
            "and aka translated_name. With ``locale``, aka matches are "
            "limited to that language."
        ),
    ),
) -> GenreListResponse:
    """Return a paginated list of genres."""

    return await service.list_genres(
        locale=locale,
        q=q,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/genres/{genre_id}",
    response_model=GenreDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get genre",
    dependencies=[
        Depends(
            cache(ttl=CACHE_TTL_SECONDS, eviction_group="genre_detail"),
        ),
        Depends(
            rate_limit(
                BURST_RATE,
                scope="genre_detail:burst",
            ),
        ),
        Depends(
            rate_limit(
                SUSTAIN_RATE,
                scope="genre_detail:sustain",
            ),
        ),
    ],
)
async def get_genre(
    genre_id: int,
    service: GenreServiceDep,
) -> GenreDetailResponse:
    """Return one genre with native Japanese name and all akas."""

    return await service.get_genre(genre_id)
