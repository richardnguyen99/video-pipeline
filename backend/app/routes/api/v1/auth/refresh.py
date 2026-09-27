"""Refresh access-token endpoint."""

from typing import Annotated, Optional

from fastapi import APIRouter, Cookie, HTTPException, status
from fastapi.responses import JSONResponse
from redis.exceptions import RedisError

from app.config import settings
from app.dependencies import AsyncRedisDep, AuthServiceDep
from app.schemas.auth import UserResponse
from app.utils.auth_cookies import set_access_token_cookie
from app.utils.jwt import (
    create_access_token,
    decode_refresh_token,
    parse_user_id,
)
from app.utils.token_denylist import is_access_jti_revoked

router = APIRouter()


@router.post(
    "/refresh",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Issue a new access token from a valid refresh cookie",
    responses={
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Missing, expired, revoked, or invalid refresh token.",
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
    """Mint a new short-lived access token when the refresh cookie is valid.

    The refresh token itself is not rotated or re-issued. Logout clears the
    refresh cookie and denylists its ``jti`` so a stolen cookie stops working
    after sign-out for the rest of its natural lifetime.
    """

    if refresh_token is None or not refresh_token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated.",
        )

    claims = decode_refresh_token(refresh_token)
    jti = claims.get("jti")

    if isinstance(jti, str) and jti:
        try:
            revoked = await is_access_jti_revoked(redis, jti)
        except RedisError:
            revoked = False

        if revoked:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token has been revoked.",
            )

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
    payload = user.model_dump(mode="json")
    response = JSONResponse(
        content=payload,
        status_code=status.HTTP_200_OK,
    )
    set_access_token_cookie(response, access)

    return response
