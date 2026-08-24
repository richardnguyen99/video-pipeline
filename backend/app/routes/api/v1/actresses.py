"""Actress collection endpoints."""

# pylint: disable=too-many-positional-arguments, too-many-locals

from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from redis_fastapi import cache, rate_limit

from app.cache.policy import (
    BURST_RATE,
    CACHE_TTL_SECONDS,
    SUSTAIN_RATE,
)
from app.dependencies import ActressServiceDep
from app.schemas.actress import ActressListResponse, ActressResponse
from app.schemas.actress_filters import ActressSort

router = APIRouter()


@router.get(
    "/actresses",
    response_model=ActressListResponse,
    status_code=status.HTTP_200_OK,
    summary="List actresses",
    dependencies=[
        Depends(
            cache(ttl=CACHE_TTL_SECONDS, eviction_group="actress_list"),
        ),
        Depends(
            rate_limit(
                BURST_RATE,
                scope="actress_list:burst",
            ),
        ),
        Depends(
            rate_limit(
                SUSTAIN_RATE,
                scope="actress_list:sustain",
            ),
        ),
    ],
)
async def list_actresses(
    service: ActressServiceDep,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    cups: Optional[List[str]] = Query(default=None),
    bust_min: Optional[int] = Query(default=None, ge=0, alias="bustMin"),
    bust_max: Optional[int] = Query(default=None, ge=0, alias="bustMax"),
    waist_min: Optional[int] = Query(default=None, ge=0, alias="waistMin"),
    waist_max: Optional[int] = Query(default=None, ge=0, alias="waistMax"),
    hip_min: Optional[int] = Query(default=None, ge=0, alias="hipMin"),
    hip_max: Optional[int] = Query(default=None, ge=0, alias="hipMax"),
    height_min: Optional[int] = Query(default=None, ge=0, alias="heightMin"),
    height_max: Optional[int] = Query(default=None, ge=0, alias="heightMax"),
    age_min: Optional[int] = Query(default=None, ge=18, le=99, alias="ageMin"),
    age_max: Optional[int] = Query(default=None, ge=18, le=99, alias="ageMax"),
    genres: Optional[List[int]] = Query(default=None),
    makers: Optional[List[int]] = Query(default=None),
    series: Optional[List[int]] = Query(default=None),
    labels: Optional[List[int]] = Query(default=None, alias="label"),
    directors: Optional[List[int]] = Query(default=None, alias="director"),
    q: Optional[str] = Query(
        default=None,
        description="Search actress name, ruby, and aka translated_name",
    ),
    sort: Optional[ActressSort] = Query(
        default=None,
        description=(
            "Sort: 1=cup 2=bust 3=waist 4=hip 5=height "
            "6=age 7=video_cnt 8=sub_cnt 9=view_cnt 10=id 11=rank "
            "(rank = relevance when q is set)"
        ),
    ),
) -> ActressListResponse:
    """Return a paginated, filterable list of actresses.

    Multi-value query keys (``cups``, ``genres``, …) use OR within the field.
    Different fields are combined with AND.
    """

    return await service.list_actresses(
        limit=limit,
        offset=offset,
        cups=cups,
        bust_min=bust_min,
        bust_max=bust_max,
        waist_min=waist_min,
        waist_max=waist_max,
        hip_min=hip_min,
        hip_max=hip_max,
        height_min=height_min,
        height_max=height_max,
        age_min=age_min,
        age_max=age_max,
        genres=genres,
        makers=makers,
        series=series,
        labels=labels,
        directors=directors,
        q=q,
        sort=sort,
    )


@router.get(
    "/actresses/{actress_id}",
    response_model=ActressResponse,
    status_code=status.HTTP_200_OK,
    summary="Get actress by id",
    dependencies=[
        Depends(
            cache(ttl=CACHE_TTL_SECONDS, eviction_group="actress_detail"),
        ),
        Depends(
            rate_limit(
                BURST_RATE,
                scope="actress_detail:burst",
            ),
        ),
        Depends(
            rate_limit(
                SUSTAIN_RATE,
                scope="actress_detail:sustain",
            ),
        ),
    ],
)
async def get_actress(
    actress_id: int,
    service: ActressServiceDep,
) -> ActressResponse:
    """Return one actress using the same payload as list items."""

    return await service.get_actress(actress_id)
