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

    async def ttl(self, name: str) -> int:
        """Remaining TTL in seconds, or a negative sentinel when absent."""


def verification_token_key(token_hash: str) -> str:
    """Redis key for a hashed email-verification token."""

    return f"auth:email_verify:{token_hash}"


def verification_active_key(user_id: UUID) -> str:
    """Redis key pointing at the active token hash for ``user_id``."""

    return f"auth:email_verify:active:{user_id}"


def verification_cooldown_key(user_id: UUID) -> str:
    """Redis key enforcing the resend cooldown for ``user_id``."""

    return f"auth:email_verify:cooldown:{user_id}"


def hash_verification_token(raw_token: str) -> str:
    """SHA-256 hex digest of the opaque verification token."""

    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def generate_verification_token() -> str:
    """Create a URL-safe opaque verification token."""

    return secrets.token_urlsafe(32)


async def get_resend_cooldown_remaining(
    store: AsyncKeyValueStore,
    user_id: UUID,
) -> int:
    """Return seconds left before the user may request another email.

    Returns:
        Positive remaining seconds, or ``0`` when resend is allowed.
    """

    remaining = await store.ttl(verification_cooldown_key(user_id))

    if remaining is None or remaining < 0:
        return 0

    return int(remaining)


async def invalidate_active_verification_token(
    store: AsyncKeyValueStore,
    user_id: UUID,
) -> None:
    """Delete the current verification token for ``user_id``, if any."""

    active_key = verification_active_key(user_id)
    raw_hash = await store.get(active_key)

    if raw_hash is None:
        return

    if isinstance(raw_hash, bytes):
        raw_hash = raw_hash.decode("utf-8")

    if not raw_hash:
        await store.delete(active_key)

        return

    await store.delete(verification_token_key(raw_hash), active_key)


async def store_verification_token(
    store: AsyncKeyValueStore,
    *,
    user_id: UUID,
    raw_token: str,
    ttl_seconds: int,
    cooldown_seconds: int,
) -> None:
    """Persist a verification token and start the resend cooldown.

    Any previously issued token for the same user is invalidated first so
    only the newest link remains valid for ``ttl_seconds``.

    Args:
        store: Async Redis client.
        user_id: Account the token confirms.
        raw_token: Opaque token sent in the email link.
        ttl_seconds: Link lifetime in seconds (e.g. 15 minutes).
        cooldown_seconds: Minimum wait before another resend is allowed.
    """

    if ttl_seconds <= 0:
        return

    await invalidate_active_verification_token(store, user_id)

    token_hash = hash_verification_token(raw_token)
    token_key = verification_token_key(token_hash)
    active_key = verification_active_key(user_id)

    await store.set(token_key, str(user_id), ex=ttl_seconds)
    await store.set(active_key, token_hash, ex=ttl_seconds)

    if cooldown_seconds > 0:
        await store.set(
            verification_cooldown_key(user_id),
            "1",
            ex=cooldown_seconds,
        )


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

    token_hash = hash_verification_token(raw_token.strip())
    key = verification_token_key(token_hash)
    raw = await store.get(key)

    if raw is None:
        return None

    if isinstance(raw, bytes):
        raw = raw.decode("utf-8")

    try:
        user_id = UUID(str(raw))
    except ValueError:
        await store.delete(key)

        return None

    active_key = verification_active_key(user_id)
    active_hash = await store.get(active_key)

    if isinstance(active_hash, bytes):
        active_hash = active_hash.decode("utf-8")

    keys_to_delete = [key]

    if active_hash == token_hash:
        keys_to_delete.append(active_key)

    await store.delete(*keys_to_delete)

    return user_id
