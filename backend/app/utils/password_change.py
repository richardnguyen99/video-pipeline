"""Redis-backed password-change intent tokens and form sessions."""

from __future__ import annotations

import hashlib
import json
import secrets
from typing import Any, Optional, Protocol
from uuid import UUID

MAX_PASSWORD_VERIFY_ATTEMPTS = 5


class AsyncKeyValueStore(Protocol):
    """Minimal async Redis interface used by password-change helpers."""

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


def _decode(raw: Optional[str | bytes]) -> Optional[str]:
    if raw is None:
        return None

    if isinstance(raw, bytes):
        return raw.decode("utf-8")

    return str(raw)


def intent_token_key(token_hash: str) -> str:
    return f"auth:password_change:intent:{token_hash}"


def intent_active_key(user_id: UUID) -> str:
    return f"auth:password_change:intent:active:{user_id}"


def intent_cooldown_key(user_id: UUID) -> str:
    return f"auth:password_change:intent:cooldown:{user_id}"


def form_session_key(form_id: str) -> str:
    return f"auth:password_change:form:{form_id}"


def hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def generate_token() -> str:
    return secrets.token_urlsafe(32)


def generate_form_id() -> str:
    return secrets.token_urlsafe(16)


def generate_xsrf_token() -> str:
    return secrets.token_urlsafe(32)


async def get_intent_cooldown_remaining(
    store: AsyncKeyValueStore,
    user_id: UUID,
) -> int:
    remaining = await store.ttl(intent_cooldown_key(user_id))

    if remaining is None or remaining < 0:
        return 0

    return int(remaining)


async def invalidate_active_intent(
    store: AsyncKeyValueStore,
    user_id: UUID,
) -> None:
    active_key = intent_active_key(user_id)
    raw_hash = _decode(await store.get(active_key))

    if not raw_hash:
        if raw_hash is not None:
            await store.delete(active_key)

        return

    await store.delete(intent_token_key(raw_hash), active_key)


async def store_intent_token(
    store: AsyncKeyValueStore,
    *,
    user_id: UUID,
    raw_token: str,
    ttl_seconds: int,
    cooldown_seconds: int,
) -> None:
    if ttl_seconds <= 0:
        return

    await invalidate_active_intent(store, user_id)
    token_hash = hash_token(raw_token)
    await store.set(intent_token_key(token_hash), str(user_id), ex=ttl_seconds)
    await store.set(intent_active_key(user_id), token_hash, ex=ttl_seconds)

    if cooldown_seconds > 0:
        await store.set(
            intent_cooldown_key(user_id),
            "1",
            ex=cooldown_seconds,
        )


async def peek_intent_user_id(
    store: AsyncKeyValueStore,
    raw_token: str,
) -> Optional[UUID]:
    if not raw_token or not raw_token.strip():
        return None

    token_hash = hash_token(raw_token.strip())
    raw_user = _decode(await store.get(intent_token_key(token_hash)))

    if not raw_user:
        return None

    try:
        return UUID(raw_user)
    except ValueError:
        return None


async def consume_intent_token(
    store: AsyncKeyValueStore,
    raw_token: str,
) -> Optional[UUID]:
    if not raw_token or not raw_token.strip():
        return None

    token_hash = hash_token(raw_token.strip())
    key = intent_token_key(token_hash)
    raw_user = _decode(await store.get(key))

    if not raw_user:
        return None

    try:
        user_id = UUID(raw_user)
    except ValueError:
        await store.delete(key)

        return None

    await store.delete(key, intent_active_key(user_id))

    return user_id


async def store_form_session(
    store: AsyncKeyValueStore,
    *,
    form_id: str,
    user_id: UUID,
    intent_token_hash: str,
    xsrf_token: str,
    ttl_seconds: int,
) -> None:
    payload = json.dumps(
        {
            "user_id": str(user_id),
            "intent_token_hash": intent_token_hash,
            "xsrf_hash": hash_token(xsrf_token),
            "attempts": 0,
            "password_verified": False,
        },
    )
    await store.set(form_session_key(form_id), payload, ex=ttl_seconds)


async def load_form_session(
    store: AsyncKeyValueStore,
    form_id: str,
) -> Optional[dict[str, object]]:
    raw = _decode(await store.get(form_session_key(form_id)))

    if not raw:
        return None

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None

    if not isinstance(data, dict):
        return None

    user_id = data.get("user_id")
    intent_token_hash = data.get("intent_token_hash")
    xsrf_hash = data.get("xsrf_hash")
    attempts = data.get("attempts", 0)
    password_verified = data.get("password_verified", False)

    if (
        not isinstance(user_id, str)
        or not isinstance(intent_token_hash, str)
        or not isinstance(xsrf_hash, str)
    ):
        return None

    try:
        attempts_int = int(attempts)
    except TypeError, ValueError:
        attempts_int = 0

    return {
        "user_id": user_id,
        "intent_token_hash": intent_token_hash,
        "xsrf_hash": xsrf_hash,
        "attempts": attempts_int,
        "password_verified": bool(password_verified),
    }


async def save_form_session(
    store: AsyncKeyValueStore,
    form_id: str,
    session: dict[str, Any],
    *,
    ttl_seconds: int,
) -> None:
    payload = json.dumps(
        {
            "user_id": session["user_id"],
            "intent_token_hash": session["intent_token_hash"],
            "xsrf_hash": session["xsrf_hash"],
            "attempts": int(session.get("attempts", 0)),
            "password_verified": bool(session.get("password_verified", False)),
        },
    )
    await store.set(form_session_key(form_id), payload, ex=ttl_seconds)


async def delete_form_session(
    store: AsyncKeyValueStore,
    form_id: str,
) -> None:
    await store.delete(form_session_key(form_id))
