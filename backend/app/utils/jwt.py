"""JWT access-token helpers (PyJWT)."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import jwt
from fastapi import HTTPException, status

from app.config import settings

TOKEN_TYPE_ACCESS = "access"


def create_access_token(
    *,
    user_id: uuid.UUID,
    email: str,
    username: str,
) -> str:
    """Create a short-lived access JWT for the given user.

    Args:
        user_id: Authenticated user's primary key.
        email: Account email (claim for convenience).
        username: Login handle (claim for convenience).

    Returns:
        Encoded JWT string.
    """

    now = datetime.now(timezone.utc)
    expires = now + timedelta(
        minutes=settings.jwt_access_token_expire_minutes,
    )
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "email": email,
        "username": username,
        "type": TOKEN_TYPE_ACCESS,
        "iat": now,
        "exp": expires,
    }

    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and validate an access JWT.

    Args:
        token: Raw JWT from the cookie or Authorization header.

    Returns:
        Verified claims dictionary.

    Raises:
        HTTPException: 401 when the token is missing, expired, or invalid.
    """

    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access token has expired.",
        ) from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token.",
        ) from exc

    if payload.get("type") != TOKEN_TYPE_ACCESS:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token type.",
        )

    subject = payload.get("sub")

    if not subject or not isinstance(subject, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token subject.",
        )

    return payload


def access_token_max_age_seconds() -> int:
    """Cookie ``Max-Age`` aligned with access-token lifetime."""

    return max(1, settings.jwt_access_token_expire_minutes * 60)


def parse_user_id(claims: dict[str, Any]) -> Optional[uuid.UUID]:
    """Extract ``sub`` as a UUID when present and valid."""

    subject = claims.get("sub")

    if not isinstance(subject, str):
        return None

    try:
        return uuid.UUID(subject)
    except ValueError:
        return None
