"""Resend-backed transactional email service."""

from __future__ import annotations

import json
import logging
from typing import Mapping, Optional, Sequence

import resend
from fastapi import HTTPException, status
from resend.exceptions import ResendError

from app.config import Settings

_logger = logging.getLogger(__name__)


class EmailService:
    """Send mail and verify webhooks through the Resend API."""

    def __init__(self, settings: Settings) -> None:
        """Create an email service bound to application settings.

        Args:
            settings: Application settings (Resend credentials).
        """

        self._settings = settings
        api_key = settings.resend_api_key

        if api_key is not None and api_key.strip():
            resend.api_key = api_key.strip()

    @property
    def is_configured(self) -> bool:
        """Return whether API key and From address are present."""

        api_key = self._settings.resend_api_key
        from_email = self._settings.resend_from_email

        return bool(
            api_key is not None
            and api_key.strip()
            and from_email is not None
            and from_email.strip()
        )

    def _require_configured(self) -> None:
        """Raise when Resend is not fully configured."""

        if not self.is_configured:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Email service is not configured.",
            )

    def send_email(
        self,
        *,
        to: Sequence[str],
        subject: str,
        html: str,
        text: Optional[str] = None,
        from_address: Optional[str] = None,
        reply_to: Optional[Sequence[str]] = None,
    ) -> str:
        """Send an HTML email via Resend.

        Args:
            to: Recipient address list.
            subject: Message subject.
            html: HTML body.
            text: Optional plain-text body.
            from_address: Override default ``RESEND_FROM_EMAIL``.
            reply_to: Optional reply-to addresses.

        Returns:
            Resend email id.

        Raises:
            HTTPException: 503 when unset; 502 when Resend rejects the send.
        """

        self._require_configured()

        sender = (
            from_address or self._settings.resend_from_email or ""
        ).strip()
        recipients = [address.strip() for address in to if address.strip()]

        if not recipients:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one recipient is required.",
            )

        if not sender:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Email From address is not configured.",
            )

        params: resend.Emails.SendParams = {
            "from": sender,
            "to": recipients,
            "subject": subject,
            "html": html,
        }

        if text is not None and text.strip():
            params["text"] = text

        if reply_to:
            cleaned = [item.strip() for item in reply_to if item.strip()]

            if cleaned:
                params["reply_to"] = cleaned

        try:
            result = resend.Emails.send(params)
        except ResendError as exc:
            _logger.exception("Resend rejected email send")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Failed to send email.",
            ) from exc

        email_id = result.get("id") if isinstance(result, Mapping) else None

        if not isinstance(email_id, str) or not email_id:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Resend returned an unexpected response.",
            )

        return email_id

    def verify_webhook(
        self,
        *,
        payload: str,
        svix_id: str,
        svix_timestamp: str,
        svix_signature: str,
    ) -> dict[str, object]:
        """Verify a Resend (Svix) webhook and return the parsed event.

        Args:
            payload: Raw request body as text.
            svix_id: ``svix-id`` header.
            svix_timestamp: ``svix-timestamp`` header.
            svix_signature: ``svix-signature`` header.

        Returns:
            Parsed JSON event object.

        Raises:
            HTTPException: 503 when secret missing; 400 when verification fails.
        """

        secret = self._settings.resend_webhook_secret

        if secret is None or not secret.strip():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Webhook secret is not configured.",
            )

        try:
            resend.Webhooks.verify(
                {
                    "payload": payload,
                    "headers": {
                        "id": svix_id,
                        "timestamp": svix_timestamp,
                        "signature": svix_signature,
                    },
                    "webhook_secret": secret.strip(),
                }
            )
        except ResendError as exc:
            _logger.exception("Resend webhook verification failed")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to verify webhook signature.",
            ) from exc

        try:
            event = json.loads(payload)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid webhook payload.",
            ) from exc

        if not isinstance(event, dict):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid webhook payload.",
            )

        return event
