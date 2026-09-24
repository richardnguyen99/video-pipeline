"""Authentication dependencies (JWT cookie → current user)."""

from __future__ import annotations

import uuid
from typing import Annotated, Optional

from fastapi import Cookie, Depends, HTTPException, status

from app.config import settings
from app.dependencies.services import AuthServiceDep
from app.schemas.auth import UserResponse
from app.utils.jwt import decode_access_token


async def get_current_user(
    service: AuthServiceDep,
    access_token: Annotated[Optional[str], Cookie()] = None,
) -> UserResponse:
    """Resolve the signed-in user from the HttpOnly access-token cookie.

    The cookie name must match ``settings.jwt_cookie_name`` (``access_token``).

    Args:
        service: Auth application service.
        access_token: JWT from the ``access_token`` cookie.

    Returns:
        Public profile for the authenticated user.

    Raises:
        HTTPException: 401 when the cookie is missing or invalid.
    """

    _ = settings.jwt_cookie_name

    if access_token is None or not access_token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated.",
        )

    claims = decode_access_token(access_token)
    subject = claims["sub"]

    try:
        user_id = uuid.UUID(subject)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token subject.",
        ) from exc

    return await service.get_current_user(user_id)


CurrentUserDep = Annotated[UserResponse, Depends(get_current_user)]
