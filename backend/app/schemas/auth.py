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
    remember_me: bool = Field(
        default=False,
        description=(
            "When true, the refresh cookie is persistent (Max-Age). "
            "When false, it is a browser session cookie."
        ),
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


class ChangePasswordRequest(BaseModel):
    """Payload for ``POST /api/v1/auth/change-password``."""

    current_password: str = Field(
        min_length=1,
        max_length=128,
        description="Existing account password for re-authentication.",
    )
    new_password: str = Field(
        min_length=8,
        max_length=128,
        description=(
            "At least 8 characters with one uppercase, one digit, "
            "and one special character."
        ),
    )

    @field_validator("new_password")
    @classmethod
    def validate_new_password_strength(cls, value: str) -> str:
        """Enforce the same strength rules as registration."""

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


class UserResponse(BaseModel):
    """Public user profile returned after registration or login."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    email: str
    display_name: Optional[str] = None
    role: str = "user"
    is_active: bool
    email_verified: bool = False
    created_at: datetime
    updated_at: datetime


class SessionResponse(UserResponse):
    """Authenticated session: public profile plus access JWT for the client.

    The access token is returned in the body so the SPA can keep it in
    memory only. The refresh token is delivered exclusively via an
    HttpOnly cookie scoped to the refresh endpoint.
    """

    access_token: str = Field(
        description="Short-lived access JWT for Authorization: Bearer.",
    )


class VerifyEmailRequest(BaseModel):
    """Payload for ``POST /api/v1/auth/verify/confirm``."""

    token: str = Field(
        min_length=16,
        max_length=256,
        description="Opaque verification token from the email link.",
    )


class VerifyEmailResponse(BaseModel):
    """Result after requesting or confirming email verification."""

    success: bool = True
    detail: str


class ForgotPasswordRequest(BaseModel):
    """Payload for ``POST /api/v1/auth/forgot-password``."""

    email: str = Field(
        max_length=255,
        description="Account email address to send the reset link to.",
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


class ForgotPasswordResponse(BaseModel):
    """Generic acknowledgement after a password-reset request."""

    success: bool = True
    detail: str


class ResetPasswordRequest(BaseModel):
    """Payload for ``POST /api/v1/auth/reset-password``."""

    token: str = Field(
        min_length=16,
        max_length=256,
        description="Opaque reset token from the email link.",
    )
    new_password: str = Field(
        min_length=8,
        max_length=128,
        description=(
            "At least 8 characters with one uppercase, one digit, "
            "and one special character."
        ),
    )

    @field_validator("new_password")
    @classmethod
    def validate_new_password_strength(cls, value: str) -> str:
        """Enforce the same strength rules as registration."""

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


class ChangeEmailRequestLinkResponse(BaseModel):
    """Result after emailing a change-email intent link."""

    success: bool = True
    detail: str


class ChangeEmailFormSessionResponse(BaseModel):
    """Form credentials bound to a valid change-email intent token."""

    form_id: str
    xsrf_token: str
    email_verified: bool
    current_email_masked: str


class ChangeEmailFormSessionRequest(BaseModel):
    """Open a change-email form for an intent token from the original email."""

    token: str = Field(
        min_length=16,
        max_length=256,
        description="Opaque intent token from the change-email link.",
    )


class ChangeEmailConfirmRequest(BaseModel):
    """Submit a new email address after proving control of the original."""

    token: str = Field(
        min_length=16,
        max_length=256,
        description="Opaque intent token from the change-email link.",
    )
    form_id: str = Field(
        min_length=8,
        max_length=128,
        description="Unique form session id issued with the form.",
    )
    xsrf_token: str = Field(
        min_length=16,
        max_length=256,
        description="XSRF token paired with form_id.",
    )
    new_email: str = Field(
        max_length=255,
        description="Desired new account email address.",
    )

    @field_validator("new_email")
    @classmethod
    def validate_email_rfc6531(cls, value: str) -> str:
        """Validate email per RFC 6531 (SMTPUTF8 / internationalized)."""

        try:
            result = validate_email(
                value.strip(),
                allow_smtputf8=True,
                check_deliverability=False,
            )
        except EmailNotValidError as exc:
            raise ValueError(str(exc)) from exc

        return result.normalized


class ChangeEmailConfirmResponse(BaseModel):
    """Outcome of submitting a new email on the change-email form."""

    success: bool = True
    detail: str
    requires_new_email_verification: bool = False
    user: Optional[UserResponse] = None


class ConfirmNewEmailRequest(BaseModel):
    """Payload for confirming a pending new email address."""

    token: str = Field(
        min_length=16,
        max_length=256,
        description="Opaque token from the new-email verification link.",
    )


class ChangeUsernameRequest(BaseModel):
    """Payload for ``POST /api/v1/auth/change-username``."""

    username: str = Field(
        min_length=3,
        max_length=50,
        description="New unique login handle (letters, digits, underscore).",
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


class ChangePasswordRequestLinkResponse(BaseModel):
    """Acknowledgement after requesting a password-change link."""

    success: bool = True
    detail: str


class ChangePasswordFormSessionRequest(BaseModel):
    """Open a password-change form for an intent token."""

    token: str = Field(
        min_length=16,
        max_length=256,
        description="Opaque intent token from the password-change link.",
    )


class ChangePasswordFormSessionResponse(BaseModel):
    """Form session issued for a valid password-change link."""

    form_id: str
    xsrf_token: str


class ChangePasswordVerifyRequest(BaseModel):
    """Re-enter the current password before choosing a new one."""

    token: str = Field(min_length=16, max_length=256)
    form_id: str = Field(min_length=8, max_length=128)
    xsrf_token: str = Field(min_length=16, max_length=256)
    current_password: str = Field(min_length=1, max_length=128)


class ChangePasswordVerifyResponse(BaseModel):
    """Result of verifying the current password on a change form."""

    success: bool
    detail: str
    attempts_remaining: int = 0
    locked_out: bool = False


class ChangePasswordConfirmLinkRequest(BaseModel):
    """Set a new password after the current password was verified."""

    token: str = Field(min_length=16, max_length=256)
    form_id: str = Field(min_length=8, max_length=128)
    xsrf_token: str = Field(min_length=16, max_length=256)
    new_password: str = Field(
        min_length=8,
        max_length=128,
        description="New password meeting registration strength rules.",
    )

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        """Enforce length and character-class rules."""

        if len(value) < 8:
            raise ValueError("Password must be at least 8 characters long.")

        if not any(char.isupper() for char in value):
            raise ValueError(
                "Password must include at least one uppercase letter."
            )

        if not any(char.isdigit() for char in value):
            raise ValueError("Password must include at least one number.")

        if not any(not char.isalnum() for char in value):
            raise ValueError(
                "Password must include at least one special character."
            )

        return value


class ChangePasswordConfirmLinkResponse(BaseModel):
    """Outcome after applying a new password via the email link."""

    success: bool = True
    detail: str


class AuthSessionItem(BaseModel):
    """One active device/browser session for the signed-in user."""

    id: uuid.UUID
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    browser_label: str
    location: Optional[str] = Field(
        default=None,
        description="City, Country when city is known; otherwise Country only.",
    )
    last_logged_in: datetime
    is_current: bool = False


class AuthSessionListResponse(BaseModel):
    """Active sessions for the current account."""

    items: list[AuthSessionItem]
