"""Request and response schemas for user biography."""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Optional
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, field_validator

_GENDER_PATTERN = re.compile(r"^[\w\s\-']{1,50}$", re.UNICODE)
_COUNTRY_PATTERN = re.compile(r"^[\w\s\-.',()]{1,100}$", re.UNICODE)


class UserBioUpdateRequest(BaseModel):
    """Payload for ``PUT /api/v1/auth/bio``.

    Every field is optional so clients can send partial updates. Sending
    ``null`` clears that field. Omitted fields are left unchanged when a
    row already exists; on first create, omitted fields stay null.
    """

    full_name: Optional[str] = Field(
        default=None,
        max_length=200,
        description="Legal or preferred full name.",
    )
    date_of_birth: Optional[date] = Field(
        default=None,
        description="Date of birth (YYYY-MM-DD). Must not be in the future.",
    )
    country: Optional[str] = Field(
        default=None,
        max_length=100,
        description="Country or region label.",
    )
    gender: Optional[str] = Field(
        default=None,
        max_length=50,
        description="Gender label.",
    )
    biography: Optional[str] = Field(
        default=None,
        max_length=5000,
        description="Free-text biography.",
    )
    link: Optional[str] = Field(
        default=None,
        max_length=2048,
        description="Single associated URL (http or https).",
    )

    @field_validator("full_name")
    @classmethod
    def normalize_full_name(cls, value: Optional[str]) -> Optional[str]:
        """Trim full name; empty becomes None."""

        if value is None:
            return None

        trimmed = value.strip()

        return trimmed or None

    @field_validator("date_of_birth")
    @classmethod
    def validate_date_of_birth(cls, value: Optional[date]) -> Optional[date]:
        """Reject future dates of birth."""

        if value is None:
            return None

        if value > date.today():
            raise ValueError("Date of birth cannot be in the future.")

        return value

    @field_validator("country")
    @classmethod
    def normalize_country(cls, value: Optional[str]) -> Optional[str]:
        """Trim country; empty becomes None; soft character check."""

        if value is None:
            return None

        trimmed = value.strip()

        if not trimmed:
            return None

        if not _COUNTRY_PATTERN.fullmatch(trimmed):
            raise ValueError("Country contains unsupported characters.")

        return trimmed

    @field_validator("gender")
    @classmethod
    def normalize_gender(cls, value: Optional[str]) -> Optional[str]:
        """Trim gender; empty becomes None; soft character check."""

        if value is None:
            return None

        trimmed = value.strip()

        if not trimmed:
            return None

        if not _GENDER_PATTERN.fullmatch(trimmed):
            raise ValueError("Gender contains unsupported characters.")

        return trimmed

    @field_validator("biography")
    @classmethod
    def normalize_biography(cls, value: Optional[str]) -> Optional[str]:
        """Trim biography; empty becomes None."""

        if value is None:
            return None

        trimmed = value.strip()

        return trimmed or None

    @field_validator("link")
    @classmethod
    def normalize_link(cls, value: Optional[str]) -> Optional[str]:
        """Trim and validate a single http(s) URL; empty becomes None."""

        if value is None:
            return None

        trimmed = value.strip()

        if not trimmed:
            return None

        parsed = urlparse(trimmed)

        if parsed.scheme not in ("http", "https") or not parsed.netloc:
            raise ValueError("Link must be an absolute http or https URL.")

        return trimmed


class UserBioResponse(BaseModel):
    """Public biography returned after read or update.

    All fields may be null when the user has not filled them in. When the
    user has never written a bio, the API still returns a response with
    every field null (no 404).
    """

    model_config = ConfigDict(from_attributes=True)

    full_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    country: Optional[str] = None
    gender: Optional[str] = None
    biography: Optional[str] = None
    link: Optional[str] = None
    updated_at: Optional[datetime] = None
