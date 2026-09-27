"""User logout endpoint."""

from typing import Annotated, Optional

from fastapi import APIRouter, Cookie, HTTPException, status
from fastapi.responses import Response
from redis.exceptions import RedisError

from app.dependencies import AsyncRedisDep
from app.utils.auth_cookies import clear_access_token_cookie
from app.utils.jwt import decode_access_token, remaining_token_ttl_seconds
from app.utils.token_denylist import revoke_access_jti

router = APIRouter()


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Sign out and revoke the access-token session",
    response_class=Response,
)
async def logout(
    redis: AsyncRedisDep,
    access_token: Annotated[Optional[str], Cookie()] = None,
) -> Response:
    """End the session immediately.

    - Clears the HttpOnly access-token cookie on the client (always).
    - Revokes the current access token ``jti`` in Redis for the rest of
      its natural lifetime so a copied cookie cannot be reused.

    Always returns 204 so the client can clear local state even when the
    cookie was already missing or the token was already invalid.
    """

    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    clear_access_token_cookie(response)

    if access_token is not None and access_token.strip():
        claims = None

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
