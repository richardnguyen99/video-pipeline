"""User login endpoint."""

from typing import Optional

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse
from redis_fastapi import rate_limit

from app.cache.policy import BURST_RATE, SUSTAIN_RATE
from app.dependencies import AuthServiceDep
from app.schemas.auth import LoginRequest, SessionResponse
from app.utils.auth_cookies import (
    clear_legacy_access_token_cookie,
    set_refresh_token_cookie,
)

router = APIRouter()


@router.post(
    "/login",
    response_model=SessionResponse,
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
    request: Request,
) -> JSONResponse:
    """Authenticate with email and password.

    On success:

    - Returns the public profile and a short-lived ``access_token`` in the
      JSON body (client stores it in memory only).
    - Sets an HttpOnly ``refresh_token`` cookie scoped to
      ``/api/v1/auth/``.
    """

    user = await service.login(body)
    user_agent = _client_user_agent(request)
    ip_address = _client_ip(request)
    access, refresh = await service.issue_session_tokens(
        user,
        user_agent=user_agent,
        ip_address=ip_address,
    )
    payload = SessionResponse(
        **user.model_dump(),
        access_token=access,
    ).model_dump(mode="json")
    response = JSONResponse(
        content=payload,
        status_code=status.HTTP_200_OK,
    )
    set_refresh_token_cookie(response, refresh)
    clear_legacy_access_token_cookie(response)

    return response


def _client_user_agent(request: Request) -> Optional[str]:
    """Return a truncated User-Agent for session metadata."""

    value = request.headers.get("user-agent")

    if value is None or not value.strip():
        return None

    return value.strip()[:255]


def _client_ip(request: Request) -> Optional[str]:
    """Best-effort client IP (first X-Forwarded-For hop or peer)."""

    forwarded = request.headers.get("x-forwarded-for")

    if forwarded is not None and forwarded.strip():
        return forwarded.split(",")[0].strip()[:45]

    if request.client is None:
        return None

    return request.client.host[:45]
