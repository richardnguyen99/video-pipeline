"""Unit tests for ``app.utils.jwt``."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi import HTTPException, status

from app.config import settings
from app.utils.jwt import (
    TOKEN_TYPE_ACCESS,
    TOKEN_TYPE_REFRESH,
    access_token_max_age_seconds,
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
    parse_user_id,
    refresh_token_max_age_seconds,
    remaining_token_ttl_seconds,
)


def test_create_access_token_returns_encoded_jwt() -> None:
    """Access token is a non-empty JWT string with expected claims."""

    user_id = uuid.UUID("00000000-0000-4000-8000-0000000000aa")
    token = create_access_token(
        user_id=user_id,
        email="alice@example.com",
        username="alice_1",
    )

    assert isinstance(token, str)
    assert token.count(".") == 2

    claims = jwt.decode(
        token,
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
    )

    assert claims["sub"] == str(user_id)
    assert claims["email"] == "alice@example.com"
    assert claims["username"] == "alice_1"
    assert claims["type"] == TOKEN_TYPE_ACCESS
    assert "exp" in claims
    assert "iat" in claims
    assert "jti" in claims
    assert isinstance(claims["jti"], str)
    assert claims["jti"]


def test_decode_access_token_round_trip() -> None:
    """Created tokens decode to the same subject and profile claims."""

    user_id = uuid.uuid4()
    token = create_access_token(
        user_id=user_id,
        email="bob@example.com",
        username="bob_1",
    )

    claims = decode_access_token(token)

    assert claims["sub"] == str(user_id)
    assert claims["email"] == "bob@example.com"
    assert claims["username"] == "bob_1"
    assert claims["type"] == TOKEN_TYPE_ACCESS
    assert isinstance(claims.get("jti"), str)
    assert claims["jti"]


def test_decode_access_token_rejects_tampered_token() -> None:
    """Signature mismatch yields HTTP 401."""

    user_id = uuid.uuid4()
    token = create_access_token(
        user_id=user_id,
        email="alice@example.com",
        username="alice_1",
    )
    tampered = token[:-4] + ("AAAA" if not token.endswith("AAAA") else "BBBB")

    with pytest.raises(HTTPException) as exc_info:
        decode_access_token(tampered)

    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert "Invalid access token" in str(exc_info.value.detail)


def test_decode_access_token_rejects_expired_token() -> None:
    """Expired signature yields HTTP 401 with an expiry message."""

    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(uuid.uuid4()),
        "email": "alice@example.com",
        "username": "alice_1",
        "type": TOKEN_TYPE_ACCESS,
        "iat": now - timedelta(hours=2),
        "exp": now - timedelta(hours=1),
    }
    token = jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )

    with pytest.raises(HTTPException) as exc_info:
        decode_access_token(token)

    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert "expired" in str(exc_info.value.detail).lower()


def test_decode_access_token_rejects_wrong_type() -> None:
    """Non-access token type yields HTTP 401."""

    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(uuid.uuid4()),
        "email": "alice@example.com",
        "username": "alice_1",
        "type": "refresh",
        "iat": now,
        "exp": now + timedelta(minutes=15),
    }
    token = jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )

    with pytest.raises(HTTPException) as exc_info:
        decode_access_token(token)

    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert "type" in str(exc_info.value.detail).lower()


def test_decode_access_token_rejects_missing_subject() -> None:
    """Missing ``sub`` claim yields HTTP 401."""

    now = datetime.now(timezone.utc)
    payload = {
        "email": "alice@example.com",
        "username": "alice_1",
        "type": TOKEN_TYPE_ACCESS,
        "iat": now,
        "exp": now + timedelta(minutes=15),
    }
    token = jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )

    with pytest.raises(HTTPException) as exc_info:
        decode_access_token(token)

    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert "subject" in str(exc_info.value.detail).lower()


def test_access_token_max_age_seconds_matches_settings() -> None:
    """Cookie max-age is at least one second and matches configured TTL."""

    expected = max(1, settings.jwt_access_token_expire_minutes * 60)

    assert access_token_max_age_seconds() == expected


def test_parse_user_id_returns_uuid() -> None:
    """Valid ``sub`` string is parsed as UUID."""

    user_id = uuid.uuid4()
    claims = {"sub": str(user_id)}

    assert parse_user_id(claims) == user_id


def test_parse_user_id_returns_none_for_invalid() -> None:
    """Missing or malformed ``sub`` yields ``None``."""

    assert parse_user_id({}) is None
    assert parse_user_id({"sub": 123}) is None
    assert parse_user_id({"sub": "not-a-uuid"}) is None


def test_remaining_token_ttl_seconds_positive() -> None:
    """Fresh token has a positive remaining TTL within the configured window."""

    token = create_access_token(
        user_id=uuid.uuid4(),
        email="alice@example.com",
        username="alice_1",
    )
    claims = decode_access_token(token)
    ttl = remaining_token_ttl_seconds(claims)
    max_ttl = settings.jwt_access_token_expire_minutes * 60

    assert 0 < ttl <= max_ttl


def test_remaining_token_ttl_seconds_zero_when_missing_exp() -> None:
    """Missing ``exp`` yields zero TTL."""

    assert remaining_token_ttl_seconds({}) == 0
    assert remaining_token_ttl_seconds({"exp": "bad"}) == 0


def test_create_refresh_token_returns_encoded_jwt() -> None:
    """Refresh token is a non-empty JWT with type=refresh and a jti."""

    user_id = uuid.UUID("00000000-0000-4000-8000-0000000000bb")
    token = create_refresh_token(user_id=user_id)

    assert isinstance(token, str)
    assert token.count(".") == 2

    claims = jwt.decode(
        token,
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
    )

    assert claims["sub"] == str(user_id)
    assert claims["type"] == TOKEN_TYPE_REFRESH
    assert "jti" in claims
    assert claims["jti"]
    assert "email" not in claims
    assert "username" not in claims


def test_decode_refresh_token_round_trip() -> None:
    """Created refresh tokens decode with the same subject."""

    user_id = uuid.uuid4()
    token = create_refresh_token(user_id=user_id)
    claims = decode_refresh_token(token)

    assert claims["sub"] == str(user_id)
    assert claims["type"] == TOKEN_TYPE_REFRESH


def test_decode_refresh_token_rejects_access_type() -> None:
    """Access tokens cannot be used as refresh tokens."""

    token = create_access_token(
        user_id=uuid.uuid4(),
        email="alice@example.com",
        username="alice_1",
    )

    with pytest.raises(HTTPException) as exc_info:
        decode_refresh_token(token)

    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert "type" in str(exc_info.value.detail).lower()


def test_decode_refresh_token_rejects_expired() -> None:
    """Expired refresh signature yields HTTP 401."""

    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(uuid.uuid4()),
        "type": TOKEN_TYPE_REFRESH,
        "jti": str(uuid.uuid4()),
        "iat": now - timedelta(days=30),
        "exp": now - timedelta(days=1),
    }
    token = jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )

    with pytest.raises(HTTPException) as exc_info:
        decode_refresh_token(token)

    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert "expired" in str(exc_info.value.detail).lower()


def test_refresh_token_max_age_seconds_matches_settings() -> None:
    """Cookie max-age matches configured refresh TTL in seconds."""

    expected = max(1, settings.jwt_refresh_token_expire_minutes * 60)

    assert refresh_token_max_age_seconds() == expected
