"""HttpOnly cookie helpers for JWT access and refresh tokens."""

from __future__ import annotations

from typing import Literal

from starlette.responses import Response

from app.config import AppEnvironment, settings
from app.utils.jwt import (
    access_token_max_age_seconds,
    refresh_token_max_age_seconds,
)

SameSite = Literal["lax", "strict", "none"]


def _cookie_samesite() -> SameSite:
    """Normalize configured SameSite to a Starlette-compatible value.

    Local development defaults to ``lax`` so host-only cookies work on
    ``http://localhost`` without HTTPS.
    """

    value = settings.jwt_cookie_samesite.strip().lower()

    if value == "strict":
        return "strict"

    if value == "none":
        return "none"

    return "lax"


def _cookie_secure(samesite: SameSite) -> bool:
    """Resolve the ``Secure`` flag for the current environment.

    Development always uses ``Secure=False`` so cookies work over plain
    HTTP on localhost. Production forces ``Secure=True`` (required when
    ``SameSite=None``).
    """

    if settings.app_env == AppEnvironment.DEVELOPMENT:
        return False

    if settings.app_env == AppEnvironment.TEST:
        return False

    if samesite == "none":
        return True

    return settings.jwt_cookie_secure


def set_access_token_cookie(response: Response, token: str) -> None:
    """Attach a short-lived access JWT as an HttpOnly cookie.

    Local development (``APP_ENV=development``):

    - ``HttpOnly`` — not readable from JavaScript
    - ``Secure=False`` — works on ``http://localhost``
    - ``SameSite=Lax`` — sent on top-level navigations and same-site XHR
    - ``Path=/`` — available to the whole API
    - No ``Domain`` — host-only cookie for the request host

    Prefer calling the API same-origin (Vite ``/api`` proxy) so the
    browser does not treat the response as cross-site.

    Args:
        response: Outgoing HTTP response.
        token: Encoded access JWT.
    """

    samesite = _cookie_samesite()
    secure = _cookie_secure(samesite)
    max_age = access_token_max_age_seconds()

    response.set_cookie(
        key=settings.jwt_cookie_name,
        value=token,
        max_age=max_age,
        expires=max_age,
        path=settings.jwt_cookie_path,
        domain=None,
        httponly=True,
        secure=secure,
        samesite=samesite,
    )


def set_refresh_token_cookie(response: Response, token: str) -> None:
    """Attach a long-lived refresh JWT as an HttpOnly cookie.

    Uses the same security attributes as the access cookie so both
    cookies behave consistently under the Vite proxy and production.

    Args:
        response: Outgoing HTTP response.
        token: Encoded refresh JWT.
    """

    samesite = _cookie_samesite()
    secure = _cookie_secure(samesite)
    max_age = refresh_token_max_age_seconds()

    response.set_cookie(
        key=settings.jwt_refresh_cookie_name,
        value=token,
        max_age=max_age,
        expires=max_age,
        path=settings.jwt_cookie_path,
        domain=None,
        httponly=True,
        secure=secure,
        samesite=samesite,
    )


def clear_access_token_cookie(response: Response) -> None:
    """Remove the access-token cookie from the client.

    Sets an empty value with ``Max-Age=0`` using the same attributes as
    ``set_access_token_cookie`` so browsers reliably drop the host-only
    cookie (including when the response is proxied through Vite).
    """

    _clear_cookie(response, settings.jwt_cookie_name)


def clear_refresh_token_cookie(response: Response) -> None:
    """Remove the refresh-token cookie from the client."""

    _clear_cookie(response, settings.jwt_refresh_cookie_name)


def _clear_cookie(response: Response, key: str) -> None:
    """Expire a host-only auth cookie with matching security attributes."""

    samesite = _cookie_samesite()
    secure = _cookie_secure(samesite)

    response.set_cookie(
        key=key,
        value="",
        max_age=0,
        expires=0,
        path=settings.jwt_cookie_path,
        domain=None,
        httponly=True,
        secure=secure,
        samesite=samesite,
    )
    response.delete_cookie(
        key=key,
        path=settings.jwt_cookie_path,
        domain=None,
        httponly=True,
        secure=secure,
        samesite=samesite,
    )
