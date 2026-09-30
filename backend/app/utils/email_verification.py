"""Redis-backed email verification tokens (15-minute TTL by default)."""

from __future__ import annotations

import hashlib
import secrets
from typing import Optional, Protocol
from uuid import UUID


class AsyncKeyValueStore(Protocol):
    """Minimal async Redis interface used by verification helpers."""

    async def set(
        self,
        name: str,
        value: str,
        ex: Optional[int] = None,
        nx: Optional[bool] = None,
    ) -> object:
        """Set a key with optional expiry in seconds."""

    async def get(self, name: str) -> Optional[str | bytes]:
        """Return the value for ``name``, if any."""

    async def delete(self, *names: str) -> object:
        """Delete one or more keys."""


def verification_token_key(token_hash: str) -> str:
    """Redis key for a hashed email-verification token."""

    return f"auth:email_verify:{token_hash}"


def hash_verification_token(raw_token: str) -> str:
    """SHA-256 hex digest of the opaque verification token."""

    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def generate_verification_token() -> str:
    """Create a URL-safe opaque verification token."""

    return secrets.token_urlsafe(32)


async def store_verification_token(
    store: AsyncKeyValueStore,
    *,
    user_id: UUID,
    raw_token: str,
    ttl_seconds: int,
) -> None:
    """Persist a verification token hash mapped to ``user_id``.

    Args:
        store: Async Redis client.
        user_id: Account the token confirms.
        raw_token: Opaque token sent in the email link.
        ttl_seconds: Lifetime in seconds (e.g. 15 minutes).
    """

    if ttl_seconds <= 0:
        return

    key = verification_token_key(hash_verification_token(raw_token))
    await store.set(key, str(user_id), ex=ttl_seconds)


async def consume_verification_token(
    store: AsyncKeyValueStore,
    raw_token: str,
) -> Optional[UUID]:
    """Look up and delete a verification token; return the user id.

    Args:
        store: Async Redis client.
        raw_token: Token from the email link.

    Returns:
        Owning user id, or ``None`` when missing/expired/invalid.
    """

    if not raw_token.strip():
        return None

    key = verification_token_key(hash_verification_token(raw_token.strip()))
    raw = await store.get(key)

    if raw is None:
        return None

    if isinstance(raw, bytes):
        raw = raw.decode("utf-8")

    await store.delete(key)

    try:
        return UUID(str(raw))
    except ValueError:
        return None
