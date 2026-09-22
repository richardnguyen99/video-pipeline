"""Unit tests for ``app.utils.password``."""

from __future__ import annotations

from app.utils.password import (
    PASSWORD_ALGORITHM,
    hash_password,
    verify_password,
)


def test_password_algorithm_is_bcrypt() -> None:
    """Algorithm label used for stored credentials is bcrypt."""

    assert PASSWORD_ALGORITHM == "bcrypt"


def test_hash_password_returns_bcrypt_string() -> None:
    """Hash output is a non-empty bcrypt-compatible string."""

    digest = hash_password("Secret1!")

    assert isinstance(digest, str)
    assert digest.startswith("$2")
    assert len(digest) > 20


def test_hash_password_uses_unique_salts() -> None:
    """Same plaintext yields different hashes (random salt)."""

    first = hash_password("Secret1!")
    second = hash_password("Secret1!")

    assert first != second


def test_verify_password_accepts_correct_password() -> None:
    """Matching plaintext verifies against its hash."""

    plain = "Secret1!"
    digest = hash_password(plain)

    assert verify_password(plain, digest) is True


def test_verify_password_rejects_wrong_password() -> None:
    """Non-matching plaintext fails verification."""

    digest = hash_password("Secret1!")

    assert verify_password("Wrong1!", digest) is False


def test_verify_password_rejects_empty_password() -> None:
    """Empty candidate does not match a real hash."""

    digest = hash_password("Secret1!")

    assert verify_password("", digest) is False
