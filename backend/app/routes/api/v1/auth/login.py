"""User login endpoint."""

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from redis_fastapi import rate_limit

from app.cache.policy import BURST_RATE, SUSTAIN_RATE
from app.dependencies import AuthServiceDep
from app.schemas.auth import LoginRequest, UserResponse
from app.utils.auth_cookies import (
    set_access_token_cookie,
    set_refresh_token_cookie,
)
from app.utils.jwt import create_access_token, create_refresh_token

router = APIRouter()


@router.post(
    "/login",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Sign in with email and password",
    responses={
        status.HTTP_400_BAD_REQUEST: {
            "description": "Invalid email format.",
        },
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Invalid email or password.",
        },
        status.HTTP_403_FORBIDDEN: {
            "description": "Account locked or disabled.",
        },
    },
    dependencies=[
        Depends(
            rate_limit(
                BURST_RATE,
                scope="auth_login:burst",
            ),
        ),
        Depends(
            rate_limit(
                SUSTAIN_RATE,
                scope="auth_login:sustain",
            ),
        ),
    ],
)
async def login(
    body: LoginRequest,
    service: AuthServiceDep,
) -> JSONResponse:
    """Authenticate with email and password.

    On success, returns the public user profile and sets HttpOnly cookies:

    - short-lived access JWT
    - long-lived refresh JWT (used by ``POST /auth/refresh``)

    Invalid credentials always yield the same 401 message to avoid account
    enumeration.
    """

    user = await service.login(body)
    access = create_access_token(
        user_id=user.id,
        email=user.email,
        username=user.username,
    )
    refresh = create_refresh_token(user_id=user.id)
    payload = user.model_dump(mode="json")
    response = JSONResponse(
        content=payload,
        status_code=status.HTTP_200_OK,
    )
    set_access_token_cookie(response, access)
    set_refresh_token_cookie(response, refresh)

    return response
