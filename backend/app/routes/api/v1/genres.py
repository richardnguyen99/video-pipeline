"""Genre collection endpoints."""

from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from redis_fastapi import cache, rate_limit

from app.cache.policy import (
    BURST_RATE,
    CACHE_TTL_SECONDS,
    SUSTAIN_RATE,
)
from app.dependencies import GenreServiceDep
from app.schemas.genre import GenreDetailResponse, GenreResponse

router = APIRouter()


@router.get(
    "/genres",
    response_model=List[GenreResponse],
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
    locale: Optional[str] = Query(
        default=None,
        description=(
            "When set, ``name`` uses ``genre_aka.translated_name`` for this "
            "language. When omitted, ``name`` is native Japanese "
            "``genre.name``."
        ),
    ),
) -> list[GenreResponse]:
    """Return all genres as a JSON array."""

    return await service.list_genres(locale=locale)


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
