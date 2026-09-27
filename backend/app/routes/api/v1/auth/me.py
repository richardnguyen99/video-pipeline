"""Current-session user endpoint."""

from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.dependencies.auth import get_current_user
from app.schemas.auth import UserResponse

router = APIRouter()


@router.get(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Return the currently authenticated user",
    responses={
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Missing or invalid access-token cookie.",
        },
    },
)
async def me(
    user: Annotated[UserResponse, Depends(get_current_user)],
) -> UserResponse:
    """Return the public profile for the session cookie.

    Clients use this to revalidate local auth state after reload or when
    the cookie may have been cleared.
    """

    return user
