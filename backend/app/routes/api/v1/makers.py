"""Maker collection endpoints."""

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from redis_fastapi import cache, rate_limit

from app.cache.policy import (
    BURST_RATE,
    CACHE_TTL_SECONDS,
    SUSTAIN_RATE,
)
from app.dependencies import MakerServiceDep
from app.schemas.maker import MakerListResponse

router = APIRouter()


@router.get(
    "/makers",
    response_model=MakerListResponse,
    status_code=status.HTTP_200_OK,
    summary="List makers",
    dependencies=[
        Depends(
            cache(ttl=CACHE_TTL_SECONDS, eviction_group="maker_list"),
        ),
        Depends(
            rate_limit(
                BURST_RATE,
                scope="maker_list:burst",
            ),
        ),
        Depends(
            rate_limit(
                SUSTAIN_RATE,
                scope="maker_list:sustain",
            ),
        ),
    ],
)
async def list_makers(
    service: MakerServiceDep,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    locale: Optional[str] = Query(
        default=None,
        description=(
            "When set, ``name`` uses ``maker_aka.translated_name`` for this "
            "language and aka search is scoped to it. When omitted, "
            "``name`` is native Japanese ``maker.name``."
        ),
    ),
    q: Optional[str] = Query(
        default=None,
        description=(
            "Space-separated search terms (AND). Matches maker name, ruby, "
            "and aka translated_name. With ``locale``, aka matches are "
            "limited to that language."
        ),
    ),
) -> MakerListResponse:
    """Return a paginated list of makers."""

    return await service.list_makers(
        locale=locale,
        q=q,
        limit=limit,
        offset=offset,
    )
