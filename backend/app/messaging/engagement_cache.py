"""Read-through / write-through Redis layer for actress engagement counts.

Flow:
1. Reads prefer Redis hashes; on miss load denormalized stats or recompute.
2. Writes (subscribe, like, …) apply deltas to Redis immediately.
3. Dirty actress ids are debounced then flushed by the write-behind worker.
"""

from __future__ import annotations

import logging
from typing import Mapping, Optional

from redis.asyncio import Redis

from app.config import settings
from app.messaging.redis_client import get_redis_client

_logger = logging.getLogger("uvicorn.error")

_HASH_PREFIX = "engagement:actress:"
_DIRTY_SET_KEY = "engagement:dirty"
_DEBOUNCE_PREFIX = "engagement:debounce:"
_COUNT_FIELDS = (
    "video_cnt",
    "sub_cnt",
    "view_cnt",
    "like_cnt",
    "comment_cnt",
)


def _hash_key(actress_id: int) -> str:
    return f"{_HASH_PREFIX}{actress_id}"


def _debounce_key(actress_id: int) -> str:
    return f"{_DEBOUNCE_PREFIX}{actress_id}"


def empty_counts() -> dict[str, int]:
    """Return zeroed engagement counters."""

    return {field: 0 for field in _COUNT_FIELDS}


def _coerce_count(value: object) -> int:
    """Parse a Redis / mapping value into a non-negative int."""

    if isinstance(value, bool):
        return 0

    if isinstance(value, int):
        return max(0, value)

    if isinstance(value, float):
        return max(0, int(value))

    if isinstance(value, (str, bytes, bytearray)):
        try:
            return max(0, int(value))
        except ValueError:
            return 0

    return 0


def counts_from_mapping(raw: Mapping[str, object]) -> dict[str, int]:
    """Normalize a Redis hash or stats row into integer counters."""

    result = empty_counts()

    for field in _COUNT_FIELDS:
        result[field] = _coerce_count(raw.get(field, 0))

    return result


class EngagementCache:
    """Redis-backed engagement counters with debounced dirty tracking."""

    def __init__(self, redis: Redis) -> None:
        self._redis = redis

    async def get_many(
        self,
        actress_ids: list[int],
    ) -> dict[int, Optional[dict[str, int]]]:
        """Return cached counts keyed by id; ``None`` means cache miss."""

        if not actress_ids:
            return {}

        pipeline = self._redis.pipeline()

        for actress_id in actress_ids:
            pipeline.hgetall(_hash_key(actress_id))

        rows = await pipeline.execute()
        result: dict[int, Optional[dict[str, int]]] = {}

        for actress_id, raw in zip(actress_ids, rows, strict=True):
            if not isinstance(raw, dict) or not raw:
                result[actress_id] = None
            else:
                result[actress_id] = counts_from_mapping(raw)

        return result

    async def set_many(
        self,
        counts_by_id: Mapping[int, Mapping[str, int]],
        *,
        ttl_seconds: Optional[int] = None,
    ) -> None:
        """Write-through full counter maps into Redis."""

        if not counts_by_id:
            return

        ttl = (
            ttl_seconds
            if ttl_seconds is not None
            else settings.engagement_cache_ttl_seconds
        )
        pipeline = self._redis.pipeline()

        for actress_id, counts in counts_by_id.items():
            key = _hash_key(actress_id)
            normalized = counts_from_mapping(counts)
            pipeline.hset(
                key,
                mapping={
                    field: str(value) for field, value in normalized.items()
                },
            )

            if ttl > 0:
                pipeline.expire(key, ttl)

        await pipeline.execute()

    async def apply_delta(
        self,
        actress_id: int,
        *,
        field: str,
        delta: int,
    ) -> Optional[int]:
        """Atomically adjust one counter when the hash already exists.

        Returns the new value, or ``None`` when the key was missing
        (caller should seed via read-through instead of applying a delta).
        """

        if field not in _COUNT_FIELDS or delta == 0:
            return None

        key = _hash_key(actress_id)
        exists = await self._redis.exists(key)

        if not exists:
            return None

        new_value = await self._redis.hincrby(key, field, delta)

        if new_value < 0:
            await self._redis.hset(key, field, 0)
            new_value = 0

        await self._redis.expire(
            key,
            settings.engagement_cache_ttl_seconds,
        )

        return int(new_value)

    async def mark_dirty_debounced(
        self,
        actress_ids: list[int],
    ) -> list[int]:
        """Add ids to the dirty set; return ids that opened a debounce window.

        Rapid successive marks for the same id only publish once per
        ``engagement_debounce_seconds`` window.
        """

        scheduled: list[int] = []

        for actress_id in actress_ids:
            if actress_id < 1:
                continue

            await self._redis.sadd(_DIRTY_SET_KEY, str(actress_id))
            acquired = await self._redis.set(
                _debounce_key(actress_id),
                "1",
                nx=True,
                ex=settings.engagement_debounce_seconds,
            )

            if acquired:
                scheduled.append(actress_id)

        return scheduled

    async def claim_dirty(self, limit: int = 200) -> list[int]:
        """Pop up to ``limit`` dirty actress ids for the write-behind worker."""

        claimed: list[int] = []

        for _ in range(max(1, limit)):
            raw = await self._redis.spop(_DIRTY_SET_KEY)

            if raw is None:
                break

            if isinstance(raw, bytes):
                text = raw.decode("utf-8")
            elif isinstance(raw, str):
                text = raw
            else:
                continue

            try:
                claimed.append(int(text))
            except ValueError:
                continue

        return claimed

    async def requeue_dirty(self, actress_ids: list[int]) -> None:
        """Return ids to the dirty set after a failed flush."""

        if not actress_ids:
            return

        await self._redis.sadd(
            _DIRTY_SET_KEY,
            *[str(actress_id) for actress_id in actress_ids],
        )


async def get_engagement_cache() -> EngagementCache:
    """Build an ``EngagementCache`` over the shared Redis client."""

    redis = await get_redis_client()

    return EngagementCache(redis)
