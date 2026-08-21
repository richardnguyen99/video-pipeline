"""Actress collection endpoints."""

# pylint: disable=too-many-positional-arguments

from typing import Optional

from fastapi import APIRouter, Query, status

from app.dependencies import ActressServiceDep
from app.schemas.actress import ActressListResponse, ActressResponse
from app.schemas.actress_filters import ActressSort

router = APIRouter()


@router.get(
    "/actresses",
    response_model=ActressListResponse,
    status_code=status.HTTP_200_OK,
    summary="List actresses",
)
async def list_actresses(
    service: ActressServiceDep,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    cups: Optional[list[str]] = Query(default=None),
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
    genres: Optional[list[int]] = Query(default=None),
    makers: Optional[list[int]] = Query(default=None),
    series: Optional[list[int]] = Query(default=None),
    labels: Optional[list[int]] = Query(default=None, alias="label"),
    directors: Optional[list[int]] = Query(default=None, alias="director"),
    sort: Optional[ActressSort] = Query(
        default=None,
        description=(
            "Descending sort: 1=cup 2=bust 3=waist 4=hip 5=height "
            "6=age 7=video_cnt 8=sub_cnt 9=view_cnt"
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
        sort=sort,
    )


@router.get(
    "/actresses/{actress_id}",
    response_model=ActressResponse,
    status_code=status.HTTP_200_OK,
    summary="Get actress by id",
)
async def get_actress(
    actress_id: int,
    service: ActressServiceDep,
) -> ActressResponse:
    """Return one actress using the same payload as list items."""

    return await service.get_actress(actress_id)
