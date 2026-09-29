"""Authentication dependencies (Bearer access JWT → current user)."""

from __future__ import annotations

import uuid
from typing import Annotated, Optional

from fastapi import Depends, Header, HTTPException, status

from app.dependencies.redis import AsyncRedisDep
from app.dependencies.services import AuthServiceDep
from app.schemas.auth import UserResponse
from app.utils.jwt import decode_access_token
from app.utils.token_denylist import is_access_jti_revoked


def _extract_bearer_token(authorization: Optional[str]) -> Optional[str]:
    """Parse ``Authorization: Bearer <token>``; return the raw token or None."""

    if authorization is None or not authorization.strip():
        return None

    scheme, _, credentials = authorization.strip().partition(" ")

    if scheme.lower() != "bearer" or not credentials.strip():
        return None

    return credentials.strip()


async def get_current_user(
    service: AuthServiceDep,
    redis: AsyncRedisDep,
    authorization: Annotated[Optional[str], Header()] = None,
) -> UserResponse:
    """Resolve the signed-in user from the ``Authorization: Bearer`` access JWT.

    Access tokens are not stored in cookies; the client holds them in memory
    and sends them on each request.

    Args:
        service: Auth application service.
        redis: Redis client for the access-token denylist.
        authorization: ``Authorization`` request header.

    Returns:
        Public profile for the authenticated user.

    Raises:
        HTTPException: 401 when the header is missing, invalid, or revoked.
    """

    access_token = _extract_bearer_token(authorization)

    if access_token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    claims = decode_access_token(access_token)
    jti = claims.get("jti")

    if isinstance(jti, str) and jti:
        if await is_access_jti_revoked(redis, jti):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Access token has been revoked.",
                headers={"WWW-Authenticate": "Bearer"},
            )

    subject = claims["sub"]

    try:
        user_id = uuid.UUID(subject)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token subject.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    return await service.get_current_user(user_id)


CurrentUserDep = Annotated[UserResponse, Depends(get_current_user)]
