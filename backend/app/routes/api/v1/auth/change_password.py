"""Password-change via emailed temporary link."""

from typing import Annotated, Optional, cast

from fastapi import APIRouter, Header, HTTPException, status
from fastapi.responses import JSONResponse, Response
from redis.exceptions import RedisError

from app.dependencies import (
    AccountPasswordServiceDep,
    AsyncRedisDep,
    CurrentUserDep,
    EmailServiceDep,
)
from app.schemas.auth import (
    ChangePasswordConfirmLinkRequest,
    ChangePasswordConfirmLinkResponse,
    ChangePasswordFormSessionRequest,
    ChangePasswordFormSessionResponse,
    ChangePasswordRequestLinkResponse,
    ChangePasswordVerifyRequest,
    ChangePasswordVerifyResponse,
)
from app.utils.auth_cookies import (
    clear_legacy_access_token_cookie,
    clear_refresh_token_cookie,
)
from app.utils.jwt import decode_access_token, remaining_token_ttl_seconds
from app.utils.password_change import AsyncKeyValueStore
from app.utils.token_denylist import revoke_access_jti

router = APIRouter()


def _extract_bearer_token(authorization: Optional[str]) -> Optional[str]:
    if authorization is None or not authorization.strip():
        return None

    scheme, _, credentials = authorization.strip().partition(" ")

    if scheme.lower() != "bearer" or not credentials.strip():
        return None

    return credentials.strip()


async def _clear_session_cookies(
    response: Response,
    redis: AsyncRedisDep,
    authorization: Optional[str],
) -> None:
    clear_refresh_token_cookie(response)
    clear_legacy_access_token_cookie(response)
    access_token = _extract_bearer_token(authorization)

    if access_token is None:
        return

    try:
        claims = decode_access_token(access_token)
    except HTTPException:
        return

    jti = claims.get("jti")
    ttl = remaining_token_ttl_seconds(claims)

    if isinstance(jti, str) and jti:
        try:
            await revoke_access_jti(redis, jti, ttl)
        except RedisError:
            pass


@router.post(
    "/change-password/request",
    response_model=ChangePasswordRequestLinkResponse,
    status_code=status.HTTP_200_OK,
    summary="Send a password-change link to the account email",
    responses={
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Missing or invalid access token.",
        },
        status.HTTP_429_TOO_MANY_REQUESTS: {
            "description": "Resend cooldown is still active.",
        },
        status.HTTP_503_SERVICE_UNAVAILABLE: {
            "description": "Email service is not configured.",
        },
    },
)
async def request_change_password_link(
    current_user: CurrentUserDep,
    service: AccountPasswordServiceDep,
    email_service: EmailServiceDep,
    redis: AsyncRedisDep,
) -> ChangePasswordRequestLinkResponse:
    """Email a temporary password-change link to the signed-in user."""

    return await service.request_change_password_link(
        current_user,
        redis=cast(AsyncKeyValueStore, redis),
        email_service=email_service,
    )


@router.post(
    "/change-password/form",
    response_model=ChangePasswordFormSessionResponse,
    status_code=status.HTTP_200_OK,
    summary="Open a password-change form for an intent token",
    responses={
        status.HTTP_400_BAD_REQUEST: {
            "description": "Invalid or expired password-change token.",
        },
    },
)
async def open_change_password_form(
    payload: ChangePasswordFormSessionRequest,
    service: AccountPasswordServiceDep,
    redis: AsyncRedisDep,
) -> ChangePasswordFormSessionResponse:
    """Return form_id and XSRF token bound to the password-change link."""

    return await service.open_change_password_form(
        payload.token,
        redis=cast(AsyncKeyValueStore, redis),
    )


@router.post(
    "/change-password/verify",
    response_model=ChangePasswordVerifyResponse,
    status_code=status.HTTP_200_OK,
    summary="Verify the current password on a change form",
    responses={
        status.HTTP_400_BAD_REQUEST: {
            "description": "Invalid form, token, or session.",
        },
    },
)
async def verify_current_password(
    payload: ChangePasswordVerifyRequest,
    service: AccountPasswordServiceDep,
    redis: AsyncRedisDep,
    authorization: Annotated[Optional[str], Header()] = None,
) -> ChangePasswordVerifyResponse | Response:
    """Confirm the current password before choosing a new one."""

    result = await service.verify_current_password(
        payload,
        redis=cast(AsyncKeyValueStore, redis),
    )

    if result.locked_out:
        response = JSONResponse(
            content=result.model_dump(),
            status_code=status.HTTP_200_OK,
        )
        await _clear_session_cookies(response, redis, authorization)

        return response

    return result


@router.post(
    "/change-password/confirm",
    response_model=ChangePasswordConfirmLinkResponse,
    status_code=status.HTTP_200_OK,
    summary="Set a new password after verifying the current one",
    responses={
        status.HTTP_400_BAD_REQUEST: {
            "description": "Invalid form, weak password, or not verified.",
        },
    },
)
async def confirm_new_password(
    payload: ChangePasswordConfirmLinkRequest,
    service: AccountPasswordServiceDep,
    redis: AsyncRedisDep,
    authorization: Annotated[Optional[str], Header()] = None,
) -> Response:
    """Apply the new password, revoke all sessions, and clear cookies."""

    result = await service.confirm_new_password(
        payload,
        redis=cast(AsyncKeyValueStore, redis),
    )
    response = JSONResponse(
        content=result.model_dump(),
        status_code=status.HTTP_200_OK,
    )
    await _clear_session_cookies(response, redis, authorization)

    return response
