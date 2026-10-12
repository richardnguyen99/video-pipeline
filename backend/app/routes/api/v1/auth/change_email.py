"""Change-email workflow endpoints."""

from typing import cast

from fastapi import APIRouter, status

from app.dependencies import (
    AccountEmailServiceDep,
    AsyncRedisDep,
    CurrentUserDep,
    EmailServiceDep,
)
from app.schemas.auth import (
    ChangeEmailConfirmRequest,
    ChangeEmailConfirmResponse,
    ChangeEmailFormSessionRequest,
    ChangeEmailFormSessionResponse,
    ChangeEmailRequestLinkResponse,
    ConfirmNewEmailRequest,
    UserResponse,
)
from app.utils.email_verification import AsyncKeyValueStore

router = APIRouter()


@router.post(
    "/change-email/request",
    response_model=ChangeEmailRequestLinkResponse,
    status_code=status.HTTP_200_OK,
    summary="Send a change-email link to the current email address",
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
async def request_change_email_link(
    current_user: CurrentUserDep,
    service: AccountEmailServiceDep,
    email_service: EmailServiceDep,
    redis: AsyncRedisDep,
) -> ChangeEmailRequestLinkResponse:
    """Email a temporary link to the account's current address."""

    return await service.request_change_email_link(
        current_user,
        redis=cast(AsyncKeyValueStore, redis),
        email_service=email_service,
    )


@router.post(
    "/change-email/form",
    response_model=ChangeEmailFormSessionResponse,
    status_code=status.HTTP_200_OK,
    summary="Open a change-email form for an intent token",
    responses={
        status.HTTP_400_BAD_REQUEST: {
            "description": "Invalid or expired change-email token.",
        },
    },
)
async def open_change_email_form(
    payload: ChangeEmailFormSessionRequest,
    service: AccountEmailServiceDep,
    redis: AsyncRedisDep,
) -> ChangeEmailFormSessionResponse:
    """Return form_id and XSRF token bound to the intent link."""

    return await service.open_change_email_form(
        payload.token,
        redis=cast(AsyncKeyValueStore, redis),
    )


@router.post(
    "/change-email/confirm",
    response_model=ChangeEmailConfirmResponse,
    status_code=status.HTTP_200_OK,
    summary="Submit a new email on a change-email form",
    responses={
        status.HTTP_400_BAD_REQUEST: {
            "description": "Invalid form, token, or email.",
        },
    },
)
async def confirm_change_email(
    payload: ChangeEmailConfirmRequest,
    service: AccountEmailServiceDep,
    email_service: EmailServiceDep,
    redis: AsyncRedisDep,
) -> ChangeEmailConfirmResponse:
    """Update immediately when unverified; otherwise verify the new address."""

    return await service.confirm_change_email(
        payload,
        redis=cast(AsyncKeyValueStore, redis),
        email_service=email_service,
    )


@router.post(
    "/change-email/confirm-new",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Confirm a pending new email address",
    responses={
        status.HTTP_400_BAD_REQUEST: {
            "description": "Invalid or expired new-email token.",
        },
    },
)
async def confirm_new_email(
    payload: ConfirmNewEmailRequest,
    service: AccountEmailServiceDep,
    redis: AsyncRedisDep,
) -> UserResponse:
    """Finalize email change after the new inbox confirms ownership."""

    return await service.confirm_new_email_change(
        payload.token,
        redis=cast(AsyncKeyValueStore, redis),
    )
