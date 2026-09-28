"""Redis-backed denylist and refresh-rotation grace cache for JWT JTIs."""

from __future__ import annotations

import json
from collections.abc import Awaitable
from dataclasses import dataclass
from typing import Optional, Protocol, Union

from redis.asyncio import Redis as AsyncRedis
from redis.asyncio.cluster import RedisCluster as AsyncRedisCluster


class AsyncKeyValueStore(Protocol):
    """Minimal async key/value interface used by unit-test fakes.

    Method shapes use ``def ... -> Awaitable[...]`` (not ``async def``) so
    they match ``redis.asyncio`` client stubs, which type coroutine methods
    that way.
    """

    def set(
        self,
        name: str,
        value: str,
        ex: Optional[int] = None,
        nx: Optional[bool] = None,
    ) -> Awaitable[object]: ...

    def get(self, name: str) -> Awaitable[Optional[str]]: ...

    def exists(self, *names: str) -> Awaitable[int]: ...


AsyncRedisClient = Union[AsyncRedis, AsyncRedisCluster, AsyncKeyValueStore]

DENYLIST_KEY_PREFIX = "auth:jti:deny:"
REFRESH_GRACE_KEY_PREFIX = "auth:refresh:grace:"


@dataclass(frozen=True, slots=True)
class RotatedTokenPair:
    """Access and refresh JWTs issued for a single rotation."""

    access_token: str
    refresh_token: str


def denylist_key(jti: str) -> str:
    """Build the Redis key for a revoked token id."""

    return f"{DENYLIST_KEY_PREFIX}{jti}"


def refresh_grace_key(jti: str) -> str:
    """Build the Redis key for a refresh-rotation grace entry."""

    return f"{REFRESH_GRACE_KEY_PREFIX}{jti}"


async def revoke_access_jti(
    store: AsyncRedisClient,
    jti: str,
    ttl_seconds: int,
) -> None:
    """Mark ``jti`` revoked until the original token would have expired.

    Overwrites an existing denylist entry (logout / forced revoke).

    Args:
        store: Async Redis client (or compatible test double).
        jti: JWT ``jti`` claim.
        ttl_seconds: Remaining lifetime of the token (key TTL).
    """

    if not jti or ttl_seconds <= 0:
        return

    await store.set(denylist_key(jti), "1", ex=ttl_seconds)


async def is_access_jti_revoked(
    store: AsyncRedisClient,
    jti: str,
) -> bool:
    """Return ``True`` when ``jti`` was revoked and the key has not expired."""

    if not jti:
        return False

    return bool(await store.exists(denylist_key(jti)))


async def consume_refresh_jti(
    store: AsyncRedisClient,
    jti: str,
    ttl_seconds: int,
) -> bool:
    """Atomically consume a refresh ``jti`` for one-time rotation.

    Uses ``SET key NX EX ttl`` so concurrent refresh requests race safely:
    only the first caller succeeds; later callers look up the grace cache
    instead of treating the request as a security breach.

    Args:
        store: Async Redis client (or compatible test double).
        jti: Refresh JWT ``jti`` claim.
        ttl_seconds: Remaining lifetime of the refresh token (key TTL).

    Returns:
        ``True`` when this caller won the race and may issue new tokens.
        ``False`` when the ``jti`` was already consumed or arguments are
        invalid.
    """

    if not jti or ttl_seconds <= 0:
        return False

    result = await store.set(
        denylist_key(jti),
        "1",
        ex=ttl_seconds,
        nx=True,
    )

    return result is not None and result is not False


async def store_refresh_rotation_grace(
    store: AsyncRedisClient,
    jti: str,
    *,
    access_token: str,
    refresh_token: str,
    grace_seconds: int,
) -> None:
    """Cache the rotated token pair for concurrent clients during the grace window.

    Args:
        store: Async Redis client (or compatible test double).
        jti: Previous refresh token ``jti`` that was just consumed.
        access_token: Newly issued access JWT.
        refresh_token: Newly issued refresh JWT.
        grace_seconds: How long late concurrent refresh calls may reuse
            this pair.
    """

    if not jti or grace_seconds <= 0:
        return

    if not access_token or not refresh_token:
        return

    payload = json.dumps(
        {
            "access_token": access_token,
            "refresh_token": refresh_token,
        },
    )
    await store.set(
        refresh_grace_key(jti),
        payload,
        ex=grace_seconds,
    )


async def get_refresh_rotation_grace(
    store: AsyncRedisClient,
    jti: str,
) -> Optional[RotatedTokenPair]:
    """Return the rotated token pair if still within the grace window.

    Args:
        store: Async Redis client (or compatible test double).
        jti: Previous refresh token ``jti``.

    Returns:
        The cached access/refresh pair, or ``None`` when missing or invalid.
    """

    result: Optional[RotatedTokenPair] = None

    if not jti:
        return None

    raw = await store.get(refresh_grace_key(jti))

    if raw is None:
        return None

    if isinstance(raw, bytes):
        raw = raw.decode("utf-8")

    if not raw:
        return None

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        data = None

    if isinstance(data, dict):
        access = data.get("access_token")
        refresh = data.get("refresh_token")

        if (
            isinstance(access, str)
            and access
            and isinstance(refresh, str)
            and refresh
        ):
            result = RotatedTokenPair(
                access_token=access, refresh_token=refresh
            )

    return result
