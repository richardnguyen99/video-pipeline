"""Actress collection endpoints."""

from fastapi import APIRouter, Query, status

from app.dependencies import ActressServiceDep
from app.schemas.actress import ActressListResponse

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
) -> ActressListResponse:
    """Return a paginated list of actresses."""

    return await service.list_actresses(limit=limit, offset=offset)
