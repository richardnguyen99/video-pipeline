"""Hash helpers for refresh-token allowlist storage."""

from __future__ import annotations

import hashlib


def hash_refresh_token(raw_token: str) -> str:
    """Return a SHA-256 hex digest of the raw refresh JWT.

    Only the digest is stored in the database (allowlist). The raw token
    is returned to the client once and never persisted.

    Args:
        raw_token: Encoded refresh JWT string.

    Returns:
        Lowercase hex SHA-256 digest.
    """

    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
