"""Refresh access-token endpoint with DB allowlist and Redis grace."""

import asyncio
import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Cookie, HTTPException, Request, status
from fastapi.responses import JSONResponse
from redis.exceptions import RedisError

from app.config import settings
from app.dependencies import AsyncRedisDep, AuthServiceDep
from app.schemas.auth import UserResponse
from app.utils.auth_cookies import (
    set_access_token_cookie,
    set_refresh_token_cookie,
)
from app.utils.jwt import decode_refresh_token, parse_user_id
from app.utils.token_denylist import (
    get_refresh_rotation_grace,
    store_refresh_rotation_grace,
)

router = APIRouter()


@router.post(
    "/refresh",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Rotate refresh token and issue a new access token",
    responses={
        status.HTTP_401_UNAUTHORIZED: {
            "description": (
                "Missing, expired, revoked, or not-allowlisted "
                "refresh token."
            ),
        },
    },
)
async def refresh(
    service: AuthServiceDep,
    redis: AsyncRedisDep,
    request: Request,
    refresh_token: Annotated[
        Optional[str],
        Cookie(alias=settings.jwt_refresh_cookie_name),
    ] = None,
) -> JSONResponse:
    """Mint new access and refresh cookies from an allowlisted refresh token.

    Allowlist (database):

    1. Validate the refresh JWT signature and type.
    2. Require a matching, non-revoked, non-expired row in
       ``refresh_token`` (hashed raw token).
    3. Rotate: revoke the old row, insert a new allowlist entry, set both
       cookies.

    Grace (Redis): concurrent requests that present the same old token
    within ``JWT_REFRESH_ROTATION_GRACE_SECONDS`` receive the same rotated
    pair instead of a hard failure after the first rotation commits.
    """

    if refresh_token is None or not refresh_token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated.",
        )

    claims = decode_refresh_token(refresh_token)
    user_id = parse_user_id(claims)

    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token subject.",
        )

    jti = claims.get("jti")

    if not isinstance(jti, str) or not jti:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token.",
        )

    existing = await service.find_refresh_token_by_raw(refresh_token)

    if existing is not None and existing.revoked_at is not None:
        return await _replay_grace_rotation(
            redis,
            service,
            jti=jti,
            user_id=user_id,
        )

    current = await service.get_allowlisted_refresh_token(
        refresh_token,
        for_update=True,
    )
    user = await service.get_current_user(user_id)
    user_agent = _client_user_agent(request)
    ip_address = _client_ip(request)
    access, new_refresh = await service.rotate_session_tokens(
        current=current,
        user=user,
        user_agent=user_agent,
        ip_address=ip_address,
    )

    grace = max(0, settings.jwt_refresh_rotation_grace_seconds)

    if grace > 0:
        try:
            await store_refresh_rotation_grace(
                redis,
                jti,
                access_token=access,
                refresh_token=new_refresh,
                grace_seconds=grace,
            )
        except RedisError:
            pass

    return _token_response(user, access=access, refresh=new_refresh)


async def _replay_grace_rotation(
    redis: AsyncRedisDep,
    service: AuthServiceDep,
    *,
    jti: str,
    user_id: uuid.UUID,
) -> JSONResponse:
    """Serve the cached rotated pair during the grace window, else 401."""

    pair = None
    last_error: Optional[BaseException] = None

    for attempt in range(4):
        try:
            pair = await get_refresh_rotation_grace(redis, jti)
        except RedisError as exc:
            last_error = exc
            pair = None

        if pair is not None:
            break

        if attempt < 3:
            await asyncio.sleep(0.05)

    if pair is None:
        if last_error is not None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unable to rotate refresh token.",
            ) from last_error

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has been revoked.",
        )

    user = await service.get_current_user(user_id)

    return _token_response(
        user,
        access=pair.access_token,
        refresh=pair.refresh_token,
    )


def _token_response(
    user: UserResponse,
    *,
    access: str,
    refresh: str,
) -> JSONResponse:
    """Build the JSON body and set both auth cookies."""

    payload = user.model_dump(mode="json")
    response = JSONResponse(
        content=payload,
        status_code=status.HTTP_200_OK,
    )
    set_access_token_cookie(response, access)
    set_refresh_token_cookie(response, refresh)

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
