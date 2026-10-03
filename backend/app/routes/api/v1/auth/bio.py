"""Authenticated user biography endpoints."""

from fastapi import APIRouter, status

from app.dependencies import AuthServiceDep
from app.dependencies.auth import CurrentUserDep
from app.schemas.user_bio import UserBioResponse, UserBioUpdateRequest

router = APIRouter()


@router.get(
    "/bio",
    response_model=UserBioResponse,
    status_code=status.HTTP_200_OK,
    summary="Return the current user's biography",
    responses={
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Missing or invalid access token.",
        },
    },
)
async def get_bio(
    current_user: CurrentUserDep,
    service: AuthServiceDep,
) -> UserBioResponse:
    """Return the signed-in user's biography.

    When the user has never filled a bio, every field is null (no 404).
    """

    return await service.get_bio(current_user)


@router.put(
    "/bio",
    response_model=UserBioResponse,
    status_code=status.HTTP_200_OK,
    summary="Create or update the current user's biography",
    responses={
        status.HTTP_400_BAD_REQUEST: {
            "description": "Invalid biography field values.",
        },
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Missing or invalid access token.",
        },
    },
)
async def update_bio(
    payload: UserBioUpdateRequest,
    current_user: CurrentUserDep,
    service: AuthServiceDep,
) -> UserBioResponse:
    """Upsert biography fields for the authenticated user.

    Partial payloads are supported: only fields present in the body are
    written. Sending ``null`` clears that field. Users may leave the bio
    empty or partially filled.
    """

    return await service.update_bio(current_user, payload)
