"""Unit tests for ``app.schemas.auth``."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from app.schemas.auth import RegisterRequest, UserResponse


def test_register_request_accepts_valid_payload() -> None:
    """Valid username, email, and password pass validation."""

    payload = RegisterRequest(
        username="alice_1",
        email="alice@example.com",
        password="Secret1!",
        display_name="Alice",
    )

    assert payload.username == "alice_1"
    assert payload.email == "alice@example.com"
    assert payload.password == "Secret1!"
    assert payload.display_name == "Alice"


def test_register_request_normalizes_username_strip() -> None:
    """Leading/trailing spaces are stripped from username."""

    payload = RegisterRequest(
        username="  alice_1  ",
        email="alice@example.com",
        password="Secret1!",
    )

    assert payload.username == "alice_1"


def test_register_request_rejects_short_username() -> None:
    """Username shorter than 3 characters is invalid."""

    with pytest.raises(ValidationError):
        RegisterRequest(
            username="ab",
            email="alice@example.com",
            password="Secret1!",
        )


def test_register_request_rejects_username_with_special_chars() -> None:
    """Username may only contain letters, digits, and underscores."""

    with pytest.raises(ValidationError):
        RegisterRequest(
            username="alice-1",
            email="alice@example.com",
            password="Secret1!",
        )


def test_register_request_rejects_invalid_email() -> None:
    """Malformed email is rejected."""

    with pytest.raises(ValidationError):
        RegisterRequest(
            username="alice_1",
            email="not-an-email",
            password="Secret1!",
        )


def test_register_request_accepts_smtputf8_email() -> None:
    """RFC 6531 internationalized addresses are accepted."""

    payload = RegisterRequest(
        username="bob_jp",
        email="ユーザー@example.com",
        password="Secret1!",
    )

    assert "@example.com" in payload.email


def test_register_request_rejects_short_password() -> None:
    """Password shorter than 8 characters is invalid."""

    with pytest.raises(ValidationError) as exc_info:
        RegisterRequest(
            username="alice_1",
            email="alice@example.com",
            password="Ab1!",
        )

    assert (
        "8" in str(exc_info.value).lower()
        or "password"
        in str(
            exc_info.value,
        ).lower()
    )


def test_register_request_rejects_password_without_uppercase() -> None:
    """Password must include an uppercase letter."""

    with pytest.raises(ValidationError) as exc_info:
        RegisterRequest(
            username="alice_1",
            email="alice@example.com",
            password="secret1!",
        )

    assert "uppercase" in str(exc_info.value).lower()


def test_register_request_rejects_password_without_digit() -> None:
    """Password must include a number."""

    with pytest.raises(ValidationError) as exc_info:
        RegisterRequest(
            username="alice_1",
            email="alice@example.com",
            password="Secret!!",
        )

    assert "number" in str(exc_info.value).lower()


def test_register_request_rejects_password_without_special() -> None:
    """Password must include a special character."""

    with pytest.raises(ValidationError) as exc_info:
        RegisterRequest(
            username="alice_1",
            email="alice@example.com",
            password="Secret11",
        )

    assert "special" in str(exc_info.value).lower()


def test_register_request_blank_display_name_becomes_none() -> None:
    """Whitespace-only display name normalizes to ``None``."""

    payload = RegisterRequest(
        username="alice_1",
        email="alice@example.com",
        password="Secret1!",
        display_name="   ",
    )

    assert payload.display_name is None


def test_user_response_from_attributes() -> None:
    """``UserResponse`` maps ORM-like attributes."""

    class _Row:
        id = uuid.UUID("00000000-0000-4000-8000-000000000001")
        username = "alice_1"
        email = "alice@example.com"
        display_name = "Alice"
        is_active = True
        created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
        updated_at = datetime(2026, 1, 1, tzinfo=timezone.utc)

    response = UserResponse.model_validate(_Row())

    assert response.username == "alice_1"
    assert response.email == "alice@example.com"
    assert response.is_active is True
