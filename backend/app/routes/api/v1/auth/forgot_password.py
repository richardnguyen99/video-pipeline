"""Forgot-password and reset-password endpoints."""

from typing import cast

from fastapi import APIRouter, status

from app.dependencies import AsyncRedisDep, AuthServiceDep, EmailServiceDep
from app.schemas.auth import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    ResetPasswordRequest,
)
from app.utils.email_verification import AsyncKeyValueStore

router = APIRouter()


@router.post(
    "/forgot-password",
    response_model=ForgotPasswordResponse,
    status_code=status.HTTP_200_OK,
    summary="Request a password-reset email",
    responses={
        status.HTTP_429_TOO_MANY_REQUESTS: {
            "description": "Resend cooldown is still active.",
        },
        status.HTTP_503_SERVICE_UNAVAILABLE: {
            "description": "Email service is not configured.",
        },
    },
)
async def forgot_password(
    payload: ForgotPasswordRequest,
    service: AuthServiceDep,
    redis: AsyncRedisDep,
    email_service: EmailServiceDep,
) -> ForgotPasswordResponse:
    """Send a password-reset link when the email matches an active account.

    The response is always the same generic message so clients cannot
    probe whether an address is registered.
    """

    detail = await service.request_password_reset(
        payload,
        redis=cast(AsyncKeyValueStore, redis),
        email_service=email_service,
    )

    return ForgotPasswordResponse(success=True, detail=detail)


@router.post(
    "/reset-password",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Set a new password using a reset token",
    responses={
        status.HTTP_400_BAD_REQUEST: {
            "description": "Invalid or expired token, or weak password.",
        },
    },
)
async def reset_password(
    payload: ResetPasswordRequest,
    service: AuthServiceDep,
    redis: AsyncRedisDep,
) -> None:
    """Consume the reset token, update the password, revoke all sessions."""

    await service.confirm_password_reset(
        payload,
        redis=cast(AsyncKeyValueStore, redis),
    )
