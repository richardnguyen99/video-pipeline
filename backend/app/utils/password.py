"""Password hashing helpers (bcrypt with per-password salt)."""

from __future__ import annotations

import bcrypt

PASSWORD_ALGORITHM = "bcrypt"


def hash_password(plain: str) -> str:
    """Hash a plaintext password with bcrypt and a random salt.

    Args:
        plain: The password in clear text.

    Returns:
        The bcrypt hash string (includes salt).
    """

    salt = bcrypt.gensalt()
    digest = bcrypt.hashpw(plain.encode("utf-8"), salt)

    return digest.decode("utf-8")


def verify_password(plain: str, password_hash: str) -> bool:
    """Check a plaintext password against a stored bcrypt hash.

    Args:
        plain: Candidate password in clear text.
        password_hash: Stored bcrypt hash from ``hash_password``.

    Returns:
        True when the password matches the hash.
    """

    return bcrypt.checkpw(
        plain.encode("utf-8"),
        password_hash.encode("utf-8"),
    )
