"""Redis-backed password-reset tokens (short TTL + resend cooldown)."""

from __future__ import annotations

import hashlib
import secrets
from typing import Optional
from uuid import UUID

from app.utils.email_verification import AsyncKeyValueStore


def password_reset_token_key(token_hash: str) -> str:
    """Redis key for a hashed password-reset token."""

    return f"auth:password_reset:{token_hash}"


def password_reset_active_key(user_id: UUID) -> str:
    """Redis key pointing at the active reset token hash for ``user_id``."""

    return f"auth:password_reset:active:{user_id}"


def password_reset_cooldown_key(email_key: str) -> str:
    """Redis key enforcing the resend cooldown for a normalized email."""

    return f"auth:password_reset:cooldown:{email_key}"


def hash_email_for_key(email: str) -> str:
    """Stable opaque key derived from a normalized email address."""

    return hashlib.sha256(email.strip().lower().encode("utf-8")).hexdigest()


def hash_password_reset_token(raw_token: str) -> str:
    """SHA-256 hex digest of the opaque reset token."""

    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def generate_password_reset_token() -> str:
    """Create a URL-safe opaque password-reset token."""

    return secrets.token_urlsafe(32)


async def get_password_reset_cooldown_remaining(
    store: AsyncKeyValueStore,
    email: str,
) -> int:
    """Return seconds left before another reset email may be requested."""

    remaining = await store.ttl(
        password_reset_cooldown_key(hash_email_for_key(email))
    )

    if remaining is None or remaining < 0:
        return 0

    return int(remaining)


async def invalidate_active_password_reset_token(
    store: AsyncKeyValueStore,
    user_id: UUID,
) -> None:
    """Delete the current password-reset token for ``user_id``, if any."""

    active_key = password_reset_active_key(user_id)
    raw_hash = await store.get(active_key)

    if raw_hash is None:
        return

    if isinstance(raw_hash, bytes):
        raw_hash = raw_hash.decode("utf-8")

    if not raw_hash:
        await store.delete(active_key)

        return

    await store.delete(password_reset_token_key(raw_hash), active_key)


async def store_password_reset_token(
    store: AsyncKeyValueStore,
    *,
    user_id: UUID,
    email: str,
    raw_token: str,
    ttl_seconds: int,
    cooldown_seconds: int,
) -> None:
    """Persist a reset token and start the resend cooldown.

    Any previously issued token for the same user is invalidated first.
    """

    if ttl_seconds <= 0:
        return

    await invalidate_active_password_reset_token(store, user_id)

    token_hash = hash_password_reset_token(raw_token)
    token_key = password_reset_token_key(token_hash)
    active_key = password_reset_active_key(user_id)

    await store.set(token_key, str(user_id), ex=ttl_seconds)
    await store.set(active_key, token_hash, ex=ttl_seconds)

    if cooldown_seconds > 0:
        await store.set(
            password_reset_cooldown_key(hash_email_for_key(email)),
            "1",
            ex=cooldown_seconds,
        )


async def consume_password_reset_token(
    store: AsyncKeyValueStore,
    raw_token: str,
) -> Optional[UUID]:
    """Look up and delete a password-reset token; return the user id."""

    if not raw_token.strip():
        return None

    token_hash = hash_password_reset_token(raw_token.strip())
    key = password_reset_token_key(token_hash)
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

    active_key = password_reset_active_key(user_id)
    active_hash = await store.get(active_key)

    if isinstance(active_hash, bytes):
        active_hash = active_hash.decode("utf-8")

    keys_to_delete = [key]

    if active_hash == token_hash:
        keys_to_delete.append(active_key)

    await store.delete(*keys_to_delete)

    return user_id
