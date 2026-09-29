"""HttpOnly cookie helpers for the refresh JWT only.

Access tokens are returned in JSON response bodies and held in client
memory (Zustand). Only the long-lived refresh token is stored as an
HttpOnly cookie, scoped to the refresh endpoint path.
"""

from __future__ import annotations

from typing import Literal

from starlette.responses import Response

from app.config import AppEnvironment, settings
from app.utils.jwt import refresh_token_max_age_seconds

SameSite = Literal["lax", "strict", "none"]


def _cookie_samesite() -> SameSite:
    """Normalize configured SameSite to a Starlette-compatible value."""

    value = settings.jwt_cookie_samesite.strip().lower()

    if value == "strict":
        return "strict"

    if value == "none":
        return "none"

    return "lax"


def _cookie_secure(samesite: SameSite) -> bool:
    """Resolve the ``Secure`` flag for the current environment."""

    if settings.app_env == AppEnvironment.DEVELOPMENT:
        return False

    if settings.app_env == AppEnvironment.TEST:
        return False

    if samesite == "none":
        return True

    return settings.jwt_cookie_secure


def set_refresh_token_cookie(response: Response, token: str) -> None:
    """Attach a long-lived refresh JWT as an HttpOnly cookie.

    ``Path`` is limited to ``settings.jwt_refresh_cookie_path`` (default
    ``/api/v1/auth/``) so the browser only attaches the cookie on auth
    routes (refresh, logout).

    Args:
        response: Outgoing HTTP response.
        token: Encoded refresh JWT.
    """

    samesite = _cookie_samesite()
    secure = _cookie_secure(samesite)
    max_age = refresh_token_max_age_seconds()
    path = settings.jwt_refresh_cookie_path

    response.set_cookie(
        key=settings.jwt_refresh_cookie_name,
        value=token,
        max_age=max_age,
        path=path,
        domain=None,
        httponly=True,
        secure=secure,
        samesite=samesite,
    )


def clear_refresh_token_cookie(response: Response) -> None:
    """Remove the refresh-token cookie (matching Path / security attrs)."""

    samesite = _cookie_samesite()
    secure = _cookie_secure(samesite)
    path = settings.jwt_refresh_cookie_path
    key = settings.jwt_refresh_cookie_name
    # Also expire previous path values so rotated Path= updates take effect.
    paths = {path, "/api/v1/auth/refresh", "/api/v1/auth/", "/"}

    for cookie_path in paths:
        response.set_cookie(
            key=key,
            value="",
            max_age=0,
            expires=0,
            path=cookie_path,
            domain=None,
            httponly=True,
            secure=secure,
            samesite=samesite,
        )
        response.delete_cookie(
            key=key,
            path=cookie_path,
            domain=None,
            httponly=True,
            secure=secure,
            samesite=samesite,
        )


def clear_legacy_access_token_cookie(response: Response) -> None:
    """Expire any leftover ``access_token`` cookie from older clients."""

    samesite = _cookie_samesite()
    secure = _cookie_secure(samesite)
    key = settings.jwt_cookie_name
    path = settings.jwt_cookie_path

    response.set_cookie(
        key=key,
        value="",
        max_age=0,
        expires=0,
        path=path,
        domain=None,
        httponly=True,
        secure=secure,
        samesite=samesite,
    )
    response.delete_cookie(
        key=key,
        path=path,
        domain=None,
        httponly=True,
        secure=secure,
        samesite=samesite,
    )
