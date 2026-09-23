"""Authentication request and response schemas."""

from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Optional

from email_validator import EmailNotValidError, validate_email
from pydantic import BaseModel, ConfigDict, Field, field_validator

_PASSWORD_SPECIAL = re.compile(r"[^A-Za-z0-9]")
_PASSWORD_UPPER = re.compile(r"[A-Z]")
_PASSWORD_DIGIT = re.compile(r"[0-9]")
_USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9_]{3,50}$")


class RegisterRequest(BaseModel):
    """Payload for ``POST /api/v1/auth/register``."""

    username: str = Field(
        min_length=3,
        max_length=50,
        description="Unique login handle (letters, digits, underscore).",
    )
    email: str = Field(
        max_length=255,
        description="Unique contact address (RFC 6531 / SMTPUTF8).",
    )
    password: str = Field(
        min_length=8,
        max_length=128,
        description=(
            "At least 8 characters with one uppercase, one digit, "
            "and one special character."
        ),
    )
    display_name: Optional[str] = Field(
        default=None,
        max_length=100,
        description="Optional display name.",
    )

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        """Normalize and validate username shape."""

        username = value.strip()

        if not _USERNAME_PATTERN.fullmatch(username):
            raise ValueError(
                "Username must be 3–50 characters and contain only "
                "letters, digits, and underscores.",
            )

        return username

    @field_validator("email")
    @classmethod
    def validate_email_rfc6531(cls, value: str) -> str:
        """Validate email per RFC 6531 (SMTPUTF8 / internationalized)."""

        try:
            result = validate_email(
                value,
                allow_smtputf8=True,
                check_deliverability=False,
            )
        except EmailNotValidError as exc:
            raise ValueError(str(exc)) from exc

        return result.normalized

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        """Enforce length and character-class rules."""

        if len(value) < 8:
            raise ValueError("Password must be at least 8 characters long.")

        if _PASSWORD_UPPER.search(value) is None:
            raise ValueError(
                "Password must contain at least one uppercase letter.",
            )

        if _PASSWORD_DIGIT.search(value) is None:
            raise ValueError("Password must contain at least one number.")

        if _PASSWORD_SPECIAL.search(value) is None:
            raise ValueError(
                "Password must contain at least one special character.",
            )

        return value

    @field_validator("display_name")
    @classmethod
    def normalize_display_name(cls, value: Optional[str]) -> Optional[str]:
        """Trim display name; empty becomes None."""

        if value is None:
            return None

        trimmed = value.strip()

        return trimmed or None


class LoginRequest(BaseModel):
    """Payload for ``POST /api/v1/auth/login``."""

    email: str = Field(
        max_length=255,
        description="Account email address.",
    )
    password: str = Field(
        min_length=1,
        max_length=128,
        description="Account password.",
    )

    @field_validator("email")
    @classmethod
    def validate_email_rfc6531(cls, value: str) -> str:
        """Validate email per RFC 6531 (SMTPUTF8 / internationalized)."""

        try:
            result = validate_email(
                value,
                allow_smtputf8=True,
                check_deliverability=False,
            )
        except EmailNotValidError as exc:
            raise ValueError(str(exc)) from exc

        return result.normalized


class UserResponse(BaseModel):
    """Public user profile returned after registration or login."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    email: str
    display_name: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
