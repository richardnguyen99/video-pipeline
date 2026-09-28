"""Refresh access-token endpoint with Redis-backed rotation and grace."""

import asyncio
from typing import Annotated, Optional

from fastapi import APIRouter, Cookie, HTTPException, status
from fastapi.responses import JSONResponse
from redis.exceptions import RedisError

from app.config import settings
from app.dependencies import AsyncRedisDep, AuthServiceDep
from app.schemas.auth import UserResponse
from app.utils.auth_cookies import (
    set_access_token_cookie,
    set_refresh_token_cookie,
)
from app.utils.jwt import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    parse_user_id,
    remaining_token_ttl_seconds,
)
from app.utils.token_denylist import (
    consume_refresh_jti,
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
                "Missing, expired, grace-expired reuse, or invalid "
                "refresh token."
            ),
        },
    },
)
async def refresh(
    service: AuthServiceDep,
    redis: AsyncRedisDep,
    refresh_token: Annotated[
        Optional[str],
        Cookie(alias=settings.jwt_refresh_cookie_name),
    ] = None,
) -> JSONResponse:
    """Mint new access and refresh cookies from a valid refresh token.

    Rotation (Redis):

    1. Validate the refresh JWT.
    2. Atomically consume its ``jti`` (``SET NX``). The winner issues a new
       access + refresh pair and stores that pair under a short-lived grace
       key.
    3. Concurrent losers that still present the *same* old refresh token
       within ``JWT_REFRESH_ROTATION_GRACE_SECONDS`` receive the **same**
       rotated pair (not a 401). After the grace window, reuse is rejected.

    This avoids multi-tab / parallel ``apiFetch`` races treating a second
    legitimate refresh as a token-theft breach.
    """

    if refresh_token is None or not refresh_token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated.",
        )

    claims = decode_refresh_token(refresh_token)
    jti = claims.get("jti")
    ttl = remaining_token_ttl_seconds(claims)

    if not isinstance(jti, str) or not jti:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token.",
        )

    if ttl <= 0:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired.",
        )

    try:
        consumed = await consume_refresh_jti(redis, jti, ttl)
    except RedisError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unable to rotate refresh token.",
        ) from exc

    if not consumed:
        return await _replay_grace_rotation(redis, service, jti=jti)

    user_id = parse_user_id(claims)

    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token subject.",
        )

    user = await service.get_current_user(user_id)
    access = create_access_token(
        user_id=user.id,
        email=user.email,
        username=user.username,
    )
    new_refresh = create_refresh_token(user_id=user.id)

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
) -> JSONResponse:
    """Serve the cached rotated pair during the grace window, else 401.

    Brief retries cover the race where this request lost ``SET NX`` before
    the winner finished writing the grace cache entry.
    """

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

    claims = decode_refresh_token(pair.refresh_token)
    user_id = parse_user_id(claims)

    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token subject.",
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
