"""User logout endpoint."""

from typing import Annotated, Optional

from fastapi import APIRouter, Cookie, Header, HTTPException, status
from fastapi.responses import Response
from redis.exceptions import RedisError

from app.config import settings
from app.dependencies import AsyncRedisDep, AuthServiceDep
from app.utils.auth_cookies import (
    clear_legacy_access_token_cookie,
    clear_refresh_token_cookie,
)
from app.utils.jwt import (
    decode_access_token,
    remaining_token_ttl_seconds,
)
from app.utils.token_denylist import revoke_access_jti

router = APIRouter()


def _extract_bearer_token(authorization: Optional[str]) -> Optional[str]:
    """Parse ``Authorization: Bearer <token>``."""

    if authorization is None or not authorization.strip():
        return None

    scheme, _, credentials = authorization.strip().partition(" ")

    if scheme.lower() != "bearer" or not credentials.strip():
        return None

    return credentials.strip()


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Sign out and revoke only the current device session",
    response_class=Response,
)
async def logout(
    redis: AsyncRedisDep,
    service: AuthServiceDep,
    authorization: Annotated[Optional[str], Header()] = None,
    refresh_token: Annotated[
        Optional[str],
        Cookie(alias=settings.jwt_refresh_cookie_name),
    ] = None,
) -> Response:
    """End **this** browser/device session only.

    Concurrent sessions on other browsers or devices stay valid.

    - Clears the HttpOnly refresh cookie on this response (and any legacy
      access cookie).
    - Revokes only the refresh allowlist row for the presented refresh
      cookie (Path ``/api/v1/auth/``). Other devices' rows are untouched.
    - Denylists only this access token ``jti`` when ``Authorization:
      Bearer`` is sent.

    Always returns 204 so the client can clear in-memory state.
    """

    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    clear_refresh_token_cookie(response)
    clear_legacy_access_token_cookie(response)

    if refresh_token is not None and refresh_token.strip():
        try:
            await service.revoke_refresh_token(refresh_token)
        except HTTPException:
            pass

    access_token = _extract_bearer_token(authorization)

    if access_token is not None:
        try:
            claims = decode_access_token(access_token)
        except HTTPException:
            claims = None

        if claims is not None:
            jti = claims.get("jti")
            ttl = remaining_token_ttl_seconds(claims)

            if isinstance(jti, str) and jti:
                try:
                    await revoke_access_jti(redis, jti, ttl)
                except RedisError:
                    pass

    return response
