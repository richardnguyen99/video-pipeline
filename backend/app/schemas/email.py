"""Email request and response schemas."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


class SendEmailRequest(BaseModel):
    """Payload for authenticated transactional send."""

    to: list[EmailStr] = Field(
        min_length=1,
        description="Recipient addresses.",
    )
    subject: str = Field(
        min_length=1,
        max_length=200,
        description="Email subject line.",
    )
    message: str = Field(
        min_length=1,
        description="Plain-text body; wrapped as simple HTML for delivery.",
    )

    @field_validator("to")
    @classmethod
    def require_recipients(cls, value: list[EmailStr]) -> list[EmailStr]:
        """Reject an empty recipient list after normalization."""

        if not value:
            raise ValueError("At least one recipient is required.")

        return value


class SendEmailResponse(BaseModel):
    """Result after a successful Resend send."""

    success: bool = True
    id: str = Field(description="Resend email id.")


class WebhookAckResponse(BaseModel):
    """Acknowledgement returned to Resend after webhook handling."""

    received: bool = True
    type: Optional[str] = None
