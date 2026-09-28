"""User logout endpoint."""

from collections.abc import Callable
from typing import Annotated, Any, Optional

from fastapi import APIRouter, Cookie, HTTPException, status
from fastapi.responses import Response
from redis.exceptions import RedisError

from app.config import settings
from app.dependencies import AsyncRedisDep, AuthServiceDep
from app.utils.auth_cookies import (
    clear_access_token_cookie,
    clear_refresh_token_cookie,
)
from app.utils.jwt import (
    decode_access_token,
    remaining_token_ttl_seconds,
)
from app.utils.token_denylist import revoke_access_jti

router = APIRouter()

DecodeFn = Callable[[str], dict[str, Any]]


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Sign out and revoke the current session tokens",
    response_class=Response,
)
async def logout(
    redis: AsyncRedisDep,
    service: AuthServiceDep,
    access_token: Annotated[Optional[str], Cookie()] = None,
    refresh_token: Annotated[
        Optional[str],
        Cookie(alias=settings.jwt_refresh_cookie_name),
    ] = None,
) -> Response:
    """End the session immediately.

    - Clears the HttpOnly access and refresh cookies on the client (always).
    - Removes the refresh token from the database allowlist so it cannot be
      reused after logout.
    - Denylists the access token ``jti`` in Redis for the rest of its natural
      lifetime.

    Always returns 204 so the client can clear local state even when the
    cookies were already missing or the tokens were already invalid.
    """

    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    clear_access_token_cookie(response)
    clear_refresh_token_cookie(response)

    if refresh_token is not None and refresh_token.strip():
        try:
            await service.revoke_refresh_token(refresh_token)
        except HTTPException:
            pass

    await _revoke_access_cookie(
        redis,
        raw_token=access_token,
        decode=decode_access_token,
    )

    return response


async def _revoke_access_cookie(
    redis: AsyncRedisDep,
    *,
    raw_token: Optional[str],
    decode: DecodeFn,
) -> None:
    """Best-effort Redis denylist of the access JWT; never raises."""

    if raw_token is None or not raw_token.strip():
        return

    claims: Optional[dict[str, Any]] = None

    try:
        claims = decode(raw_token)
    except HTTPException:
        claims = None

    if claims is None:
        return

    jti = claims.get("jti")
    ttl = remaining_token_ttl_seconds(claims)

    if not isinstance(jti, str) or not jti:
        return

    try:
        await revoke_access_jti(redis, jti, ttl)
    except RedisError:
        pass
