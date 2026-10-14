"""List recent account and content activity for the signed-in user."""

from __future__ import annotations

from fastapi import APIRouter, Query, status

from app.dependencies import AuthServiceDep, CurrentUserDep
from app.schemas.auth import UserActivityListResponse

router = APIRouter()


@router.get(
    "/activity",
    response_model=UserActivityListResponse,
    status_code=status.HTTP_200_OK,
    summary="List recent activity for the signed-in account",
    responses={
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Missing or invalid access token.",
        },
    },
)
async def list_activity(
    user: CurrentUserDep,
    service: AuthServiceDep,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> UserActivityListResponse:
    """Return login, credential, and content actions for the current user."""

    return await service.list_activity(
        user.id,
        limit=limit,
        offset=offset,
    )
