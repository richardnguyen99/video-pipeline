"""Email verification endpoints."""

from typing import cast

from fastapi import APIRouter, status

from app.dependencies import (
    AsyncRedisDep,
    AuthServiceDep,
    CurrentUserDep,
    EmailServiceDep,
)
from app.schemas.auth import (
    UserResponse,
    VerifyEmailRequest,
    VerifyEmailResponse,
)
from app.utils.email_verification import AsyncKeyValueStore

router = APIRouter()


@router.post(
    "/verify",
    response_model=VerifyEmailResponse,
    status_code=status.HTTP_200_OK,
    summary="Send an email verification link",
    responses={
        status.HTTP_400_BAD_REQUEST: {
            "description": "Email already verified.",
        },
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Missing or invalid access token.",
        },
        status.HTTP_503_SERVICE_UNAVAILABLE: {
            "description": "Email service is not configured.",
        },
    },
)
async def request_verification(
    current_user: CurrentUserDep,
    service: AuthServiceDep,
    email_service: EmailServiceDep,
    redis: AsyncRedisDep,
) -> VerifyEmailResponse:
    """Email a unique verification link to the signed-in user.

    The link is valid for ``EMAIL_VERIFICATION_EXPIRE_MINUTES`` (default 15).
    """

    await service.request_email_verification(
        current_user,
        redis=cast(AsyncKeyValueStore, redis),
        email_service=email_service,
    )

    return VerifyEmailResponse(
        success=True,
        detail="Verification email sent. Check your inbox.",
    )


@router.post(
    "/verify/confirm",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Confirm email verification from a link token",
    responses={
        status.HTTP_400_BAD_REQUEST: {
            "description": "Invalid or expired verification token.",
        },
    },
)
async def confirm_verification(
    payload: VerifyEmailRequest,
    service: AuthServiceDep,
    redis: AsyncRedisDep,
) -> UserResponse:
    """Consume the token from the email link and mark the account verified."""

    return await service.confirm_email_verification(
        payload.token,
        redis=cast(AsyncKeyValueStore, redis),
    )
