"""Label collection endpoints."""

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from redis_fastapi import cache, rate_limit

from app.cache.policy import (
    BURST_RATE,
    CACHE_TTL_SECONDS,
    SUSTAIN_RATE,
)
from app.dependencies import LabelServiceDep
from app.schemas.label import LabelListResponse

router = APIRouter()


@router.get(
    "/labels",
    response_model=LabelListResponse,
    status_code=status.HTTP_200_OK,
    summary="List labels",
    dependencies=[
        Depends(
            cache(ttl=CACHE_TTL_SECONDS, eviction_group="label_list"),
        ),
        Depends(
            rate_limit(
                BURST_RATE,
                scope="label_list:burst",
            ),
        ),
        Depends(
            rate_limit(
                SUSTAIN_RATE,
                scope="label_list:sustain",
            ),
        ),
    ],
)
async def list_labels(
    service: LabelServiceDep,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    locale: Optional[str] = Query(
        default=None,
        description=(
            "When set, ``name`` uses ``label_aka.translated_name`` for this "
            "language and aka search is scoped to it. When omitted, "
            "``name`` is native Japanese ``label.name``."
        ),
    ),
    q: Optional[str] = Query(
        default=None,
        description=(
            "Space-separated search terms (AND). Matches label name, ruby, "
            "and aka translated_name. With ``locale``, aka matches are "
            "limited to that language."
        ),
    ),
) -> LabelListResponse:
    """Return a paginated list of labels."""

    return await service.list_labels(
        locale=locale,
        q=q,
        limit=limit,
        offset=offset,
    )
