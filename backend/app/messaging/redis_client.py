"""Standalone async Redis client for workers (outside request DI)."""

from __future__ import annotations

from typing import Optional

from redis.asyncio import Redis

from app.config import settings


class RedisClientHolder:
    """Owns the shared asyncio Redis client used by background workers."""

    def __init__(self) -> None:
        self._client: Optional[Redis] = None

    async def get(self) -> Redis:
        """Return a shared asyncio Redis client, creating it if needed."""

        if self._client is None:
            self._client = Redis(
                host=settings.redis_host,
                port=settings.redis_port,
                password=settings.redis_password or None,
                decode_responses=True,
            )

        return self._client

    async def close(self) -> None:
        """Close the shared client."""

        if self._client is not None:
            await self._client.aclose()
            self._client = None


_holder = RedisClientHolder()


async def get_redis_client() -> Redis:
    """Return a shared asyncio Redis client."""

    return await _holder.get()


async def close_redis_client() -> None:
    """Close the shared client."""

    await _holder.close()
