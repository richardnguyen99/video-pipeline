"""Resend email routes (send + webhook)."""

from __future__ import annotations

import logging
from html import escape
from typing import Annotated, Optional

from fastapi import APIRouter, Header, HTTPException, Request, status

from app.dependencies import CurrentUserDep, EmailServiceDep
from app.schemas.email import (
    SendEmailRequest,
    SendEmailResponse,
    WebhookAckResponse,
)

router = APIRouter(prefix="/email")
_logger = logging.getLogger(__name__)


@router.post(
    "/send",
    response_model=SendEmailResponse,
    status_code=status.HTTP_200_OK,
    summary="Send a transactional email via Resend",
    responses={
        status.HTTP_400_BAD_REQUEST: {
            "description": "Invalid recipients or body.",
        },
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Missing or invalid access token.",
        },
        status.HTTP_502_BAD_GATEWAY: {
            "description": "Resend rejected the send.",
        },
        status.HTTP_503_SERVICE_UNAVAILABLE: {
            "description": "Resend is not configured.",
        },
    },
)
async def send_email(
    payload: SendEmailRequest,
    current_user: CurrentUserDep,
    email_service: EmailServiceDep,
) -> SendEmailResponse:
    """Send an email on behalf of the authenticated user.

    The caller must present a valid access token. Body text is HTML-escaped
    and wrapped in a simple paragraph for delivery.
    """

    _ = current_user
    html = f"<p>{escape(payload.message)}</p>"
    email_id = email_service.send_email(
        to=[str(address) for address in payload.to],
        subject=payload.subject,
        html=html,
        text=payload.message,
    )

    return SendEmailResponse(success=True, id=email_id)


@router.post(
    "/webhook",
    response_model=WebhookAckResponse,
    status_code=status.HTTP_200_OK,
    summary="Receive Resend webhook events",
    responses={
        status.HTTP_400_BAD_REQUEST: {
            "description": "Missing headers or invalid signature.",
        },
        status.HTTP_503_SERVICE_UNAVAILABLE: {
            "description": "Webhook secret is not configured.",
        },
    },
)
async def handle_resend_webhook(
    request: Request,
    email_service: EmailServiceDep,
    svix_id: Annotated[Optional[str], Header(alias="svix-id")] = None,
    svix_timestamp: Annotated[
        Optional[str],
        Header(alias="svix-timestamp"),
    ] = None,
    svix_signature: Annotated[
        Optional[str],
        Header(alias="svix-signature"),
    ] = None,
) -> WebhookAckResponse:
    """Verify and acknowledge Resend delivery events.

    Configure the endpoint URL in the Resend dashboard. Signature
    verification uses ``RESEND_WEBHOOK_SECRET``.
    """

    if svix_id is None or svix_timestamp is None or svix_signature is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing webhook headers.",
        )

    payload_bytes = await request.body()
    payload_str = payload_bytes.decode("utf-8")
    event = email_service.verify_webhook(
        payload=payload_str,
        svix_id=svix_id,
        svix_timestamp=svix_timestamp,
        svix_signature=svix_signature,
    )
    event_type = event.get("type")
    type_str = event_type if isinstance(event_type, str) else None

    if type_str is not None:
        _logger.info("Resend webhook event type=%s", type_str)

    return WebhookAckResponse(received=True, type=type_str)
