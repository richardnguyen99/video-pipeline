"""JWT access- and refresh-token helpers (PyJWT)."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import jwt
from fastapi import HTTPException, status

from app.config import settings

TOKEN_TYPE_ACCESS = "access"
TOKEN_TYPE_REFRESH = "refresh"


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
        "jti": str(uuid.uuid4()),
        "iat": now,
        "exp": expires,
    }

    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def create_refresh_token(*, user_id: uuid.UUID) -> str:
    """Create a long-lived refresh JWT for the given user.

    Refresh tokens only carry ``sub`` / ``type`` / ``jti`` so they can mint
    new access tokens without embedding profile claims. Each successful
    ``POST /auth/refresh`` rotates the token: the previous ``jti`` is
    denylisted in Redis and a new refresh JWT is issued.

    Args:
        user_id: Authenticated user's primary key.

    Returns:
        Encoded JWT string.
    """

    now = datetime.now(timezone.utc)
    expires = now + timedelta(
        minutes=settings.jwt_refresh_token_expire_minutes,
    )
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "type": TOKEN_TYPE_REFRESH,
        "jti": str(uuid.uuid4()),
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

    payload = _decode_jwt(token, expected_type=TOKEN_TYPE_ACCESS)

    return payload


def decode_refresh_token(token: str) -> dict[str, Any]:
    """Decode and validate a refresh JWT.

    Args:
        token: Raw JWT from the refresh cookie.

    Returns:
        Verified claims dictionary.

    Raises:
        HTTPException: 401 when the token is missing, expired, or invalid.
    """

    payload = _decode_jwt(token, expected_type=TOKEN_TYPE_REFRESH)

    return payload


def _decode_jwt(token: str, *, expected_type: str) -> dict[str, Any]:
    """Shared JWT decode with type and subject checks."""

    label = "access" if expected_type == TOKEN_TYPE_ACCESS else "refresh"

    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"{label.capitalize()} token has expired.",
        ) from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid {label} token.",
        ) from exc

    if payload.get("type") != expected_type:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid {label} token type.",
        )

    subject = payload.get("sub")

    if not subject or not isinstance(subject, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid {label} token subject.",
        )

    return payload


def access_token_max_age_seconds() -> int:
    """Cookie ``Max-Age`` aligned with access-token lifetime."""

    return max(1, settings.jwt_access_token_expire_minutes * 60)


def refresh_token_max_age_seconds() -> int:
    """Cookie ``Max-Age`` aligned with refresh-token lifetime."""

    return max(1, settings.jwt_refresh_token_expire_minutes * 60)


def parse_user_id(claims: dict[str, Any]) -> Optional[uuid.UUID]:
    """Extract ``sub`` as a UUID when present and valid."""

    subject = claims.get("sub")

    if not isinstance(subject, str):
        return None

    try:
        return uuid.UUID(subject)
    except ValueError:
        return None


def remaining_token_ttl_seconds(claims: dict[str, Any]) -> int:
    """Seconds until ``exp``, or ``0`` when already expired / missing."""

    exp = claims.get("exp")

    if not isinstance(exp, (int, float)):
        return 0

    remaining = int(exp) - int(datetime.now(timezone.utc).timestamp())

    return max(0, remaining)
