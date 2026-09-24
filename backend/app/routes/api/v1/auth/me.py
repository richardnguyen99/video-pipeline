"""Current-session user endpoint."""

from fastapi import APIRouter, status

from app.dependencies.auth import CurrentUserDep
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
async def me(user: CurrentUserDep) -> UserResponse:
    """Return the public profile for the session cookie.

    Clients use this to revalidate local auth state after reload or when
    the cookie may have been cleared.
    """

    return user
