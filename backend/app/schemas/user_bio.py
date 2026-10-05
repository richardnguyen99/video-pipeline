"""Request and response schemas for user biography."""

from __future__ import annotations

import re
from datetime import date, datetime
from enum import StrEnum
from typing import Optional
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, field_validator

_COUNTRY_ALPHA3_PATTERN = re.compile(r"^[A-Z]{3}$")


class Gender(StrEnum):
    """Allowed gender labels for user biography."""

    MALE = "Male"
    FEMALE = "Female"
    LESBIAN = "Lesbian"
    GAY = "Gay"
    BI_SEXUAL = "Bi-sexual"
    TRANSGENDER = "Transgender"
    QUEER = "Queer"
    INTERSEX = "Intersex"
    AGENDER = "Agender"
    UNKNOWN = "Unknown"


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
        max_length=3,
        min_length=3,
        description="ISO 3166-1 alpha-3 country code (e.g. USA, VNM).",
    )
    gender: Optional[str] = Field(
        default=None,
        max_length=50,
        description=(
            "Gender label. Allowed values: "
            + ", ".join(item.value for item in Gender)
            + "."
        ),
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

    @field_validator("country", mode="before")
    @classmethod
    def normalize_country(cls, value: object) -> object:
        """Normalize to uppercase ISO alpha-3; empty becomes None."""

        if value is None:
            return None

        if not isinstance(value, str):
            raise ValueError("Country must be a string.")

        trimmed = value.strip().upper()

        if not trimmed:
            return None

        if not _COUNTRY_ALPHA3_PATTERN.fullmatch(trimmed):
            raise ValueError(
                "Country must be a 3-letter ISO 3166-1 alpha-3 code.",
            )

        return trimmed

    @field_validator("gender", mode="before")
    @classmethod
    def normalize_gender(cls, value: object) -> object:
        """Trim gender; empty becomes None. Enum membership is enforced in the service."""

        if value is None:
            return None

        if isinstance(value, Gender):
            return value.value

        if not isinstance(value, str):
            raise ValueError("Gender must be a string.")

        trimmed = value.strip()

        return trimmed or None

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
