"""Change-password endpoint."""

from typing import Annotated, Optional

from fastapi import APIRouter, Header, HTTPException, status
from fastapi.responses import Response
from redis.exceptions import RedisError

from app.dependencies import AsyncRedisDep, AuthServiceDep
from app.dependencies.auth import CurrentUserDep
from app.schemas.auth import ChangePasswordRequest
from app.utils.auth_cookies import (
    clear_legacy_access_token_cookie,
    clear_refresh_token_cookie,
)
from app.utils.jwt import decode_access_token, remaining_token_ttl_seconds
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
    "/change-password",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Change password and revoke all sessions",
    response_class=Response,
    responses={
        status.HTTP_400_BAD_REQUEST: {
            "description": "Weak new password or same as current.",
        },
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Missing access token or wrong current password.",
        },
    },
)
async def change_password(
    payload: ChangePasswordRequest,
    current_user: CurrentUserDep,
    service: AuthServiceDep,
    redis: AsyncRedisDep,
    authorization: Annotated[Optional[str], Header()] = None,
) -> Response:
    """Update the password for the authenticated user.

    1. Verify the access JWT (via ``CurrentUserDep``).
    2. Verify ``current_password`` against the stored bcrypt hash.
    3. Persist the new hash and stamp ``password_changed_at``.
    4. Revoke **every** refresh-token allowlist row for the user (all
       browsers and devices).
    5. Clear this response's refresh cookie and denylist the current
       access ``jti``.
    6. Access tokens on other devices are rejected because their ``iat``
       predates ``password_changed_at``.

    The client must clear its in-memory access token and sign in again.
    """

    await service.change_password(current_user, payload)

    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    clear_refresh_token_cookie(response)
    clear_legacy_access_token_cookie(response)

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
