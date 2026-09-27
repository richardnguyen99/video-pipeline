"""Redis-backed denylist for revoked access-token JTIs."""

from __future__ import annotations

from collections.abc import Awaitable
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
    ) -> Awaitable[object]: ...

    def exists(self, *names: str) -> Awaitable[int]: ...


AsyncRedisClient = Union[AsyncRedis, AsyncRedisCluster, AsyncKeyValueStore]

DENYLIST_KEY_PREFIX = "auth:access:deny:"


def denylist_key(jti: str) -> str:
    """Build the Redis key for a token id."""

    return f"{DENYLIST_KEY_PREFIX}{jti}"


async def revoke_access_jti(
    store: AsyncRedisClient,
    jti: str,
    ttl_seconds: int,
) -> None:
    """Mark ``jti`` revoked until the original token would have expired.

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
