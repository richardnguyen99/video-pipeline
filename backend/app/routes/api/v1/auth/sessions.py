"""List and revoke active authentication sessions."""

from __future__ import annotations

import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Cookie, Response, status

from app.config import settings
from app.dependencies import AuthServiceDep, CurrentUserDep
from app.schemas.auth import AuthSessionListResponse
from app.utils.auth_cookies import (
    clear_legacy_access_token_cookie,
    clear_refresh_token_cookie,
)

router = APIRouter()


@router.get(
    "/sessions",
    response_model=AuthSessionListResponse,
    status_code=status.HTTP_200_OK,
    summary="List active sessions for the signed-in account",
    responses={
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Missing or invalid access token.",
        },
    },
)
async def list_sessions(
    user: CurrentUserDep,
    service: AuthServiceDep,
    refresh_token: Annotated[
        Optional[str],
        Cookie(alias=settings.jwt_refresh_cookie_name),
    ] = None,
) -> AuthSessionListResponse:
    """Return only active (non-revoked, non-expired) sessions for the caller."""

    return await service.list_sessions(
        user.id,
        current_refresh_token=refresh_token,
    )


@router.delete(
    "/sessions/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="Revoke a single session by id",
    responses={
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Missing or invalid access token.",
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "Session not found for this account.",
        },
    },
)
async def revoke_session(
    session_id: uuid.UUID,
    user: CurrentUserDep,
    service: AuthServiceDep,
) -> Response:
    """End one device session owned by the caller."""

    await service.revoke_session_by_id(user.id, session_id)

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/sessions/revoke-all",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="Revoke every active session for the signed-in account",
    responses={
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Missing or invalid access token.",
        },
    },
)
async def revoke_all_sessions(
    user: CurrentUserDep,
    service: AuthServiceDep,
) -> Response:
    """Sign out every device, including the current browser."""

    await service.revoke_all_refresh_tokens(user.id)
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    clear_refresh_token_cookie(response)
    clear_legacy_access_token_cookie(response)

    return response
