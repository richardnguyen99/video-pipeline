"""Standalone async Redis client for workers (outside request DI)."""

from __future__ import annotations

import asyncio
from typing import Optional

from redis.asyncio import Redis

from app.config import settings


class RedisClientHolder:
    """Owns the shared asyncio Redis client used by background workers."""

    def __init__(self) -> None:
        self._client: Optional[Redis] = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    def _build(self) -> Redis:
        return Redis(
            host=settings.redis_host,
            port=settings.redis_port,
            password=settings.redis_password or None,
            decode_responses=True,
        )

    async def get(self) -> Redis:
        """Return a shared asyncio Redis client, creating it if needed.

        Recreates the client when the event loop changes (pytest-asyncio
        and other environments that close loops between tasks).
        """

        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if self._client is not None and self._loop is not loop:
            try:
                await self._client.aclose()
            except RuntimeError, OSError:
                pass

            self._client = None
            self._loop = None

        if self._client is None:
            self._client = self._build()
            self._loop = loop

        return self._client

    async def close(self) -> None:
        """Close the shared client."""

        if self._client is not None:
            try:
                await self._client.aclose()
            except RuntimeError, OSError:
                pass

            self._client = None
            self._loop = None


_holder = RedisClientHolder()


async def get_redis_client() -> Redis:
    """Return a shared asyncio Redis client."""

    return await _holder.get()


async def close_redis_client() -> None:
    """Close the shared client."""

    await _holder.close()
