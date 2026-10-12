"""Change-username endpoint."""

from fastapi import APIRouter, status

from app.dependencies import AuthServiceDep, CurrentUserDep
from app.schemas.auth import ChangeUsernameRequest, UserResponse

router = APIRouter()


@router.post(
    "/change-username",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Change the authenticated user's username",
    responses={
        status.HTTP_400_BAD_REQUEST: {
            "description": "Username unchanged or fails validation.",
        },
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Missing or invalid access token.",
        },
        status.HTTP_409_CONFLICT: {
            "description": "Username is already taken.",
        },
    },
)
async def change_username(
    payload: ChangeUsernameRequest,
    current_user: CurrentUserDep,
    service: AuthServiceDep,
) -> UserResponse:
    """Update the unique username for the signed-in account."""

    return await service.change_username(current_user, payload)
