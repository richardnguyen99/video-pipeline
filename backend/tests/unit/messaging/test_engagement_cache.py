"""Unit tests for engagement Redis helpers (in-memory fake Redis)."""

from __future__ import annotations

from typing import Any, Optional

import pytest

from app.messaging.engagement_cache import EngagementCache, empty_counts


class _FakeRedis:
    """Minimal async Redis stand-in for engagement cache unit tests."""

    def __init__(self) -> None:
        self.hashes: dict[str, dict[str, str]] = {}
        self.sets: dict[str, set[str]] = {}
        self.strings: dict[str, str] = {}
        self.expiries: dict[str, int] = {}

    def pipeline(self) -> "_FakePipeline":
        return _FakePipeline(self)

    async def exists(self, key: str) -> int:
        return 1 if key in self.hashes else 0

    async def hincrby(self, key: str, field: str, delta: int) -> int:
        bucket = self.hashes.setdefault(key, {})
        current = int(bucket.get(field, "0"))
        current += delta
        bucket[field] = str(current)

        return current

    async def hset(
        self,
        key: str,
        field: Optional[str] = None,
        value: Optional[str] = None,
        mapping: Optional[dict[str, Any]] = None,
    ) -> int:
        bucket = self.hashes.setdefault(key, {})

        if mapping is not None:
            for map_key, map_value in mapping.items():
                bucket[str(map_key)] = str(map_value)

            return len(mapping)

        if field is not None and value is not None:
            bucket[str(field)] = str(value)

            return 1

        return 0

    async def expire(self, key: str, ttl: int) -> bool:
        self.expiries[key] = ttl

        return True

    async def sadd(self, key: str, *values: str) -> int:
        bucket = self.sets.setdefault(key, set())
        before = len(bucket)

        for value in values:
            bucket.add(str(value))

        return len(bucket) - before

    async def set(
        self,
        key: str,
        value: str,
        nx: bool = False,
        ex: Optional[int] = None,
    ) -> Optional[bool]:
        if nx and key in self.strings:
            return None

        self.strings[key] = value

        if ex is not None:
            self.expiries[key] = ex

        return True

    async def spop(self, key: str) -> Optional[str]:
        bucket = self.sets.get(key)

        if not bucket:
            return None

        value = bucket.pop()

        return value


class _FakePipeline:
    def __init__(self, redis: _FakeRedis) -> None:
        self._redis = redis
        self._ops: list[tuple[Any, ...]] = []

    def hgetall(self, key: str) -> "_FakePipeline":
        self._ops.append(("hgetall", key))

        return self

    def hset(self, key: str, mapping: dict[str, Any]) -> "_FakePipeline":
        self._ops.append(("hset", key, mapping))

        return self

    def expire(self, key: str, ttl: int) -> "_FakePipeline":
        self._ops.append(("expire", key, ttl))

        return self

    async def execute(self) -> list[Any]:
        results: list[Any] = []

        for op in self._ops:
            name = op[0]

            if name == "hgetall":
                key = str(op[1])
                results.append(dict(self._redis.hashes.get(key, {})))
            elif name == "hset":
                key = str(op[1])
                mapping = op[2]
                assert isinstance(mapping, dict)
                await self._redis.hset(key, mapping=mapping)
                results.append(True)
            elif name == "expire":
                key = str(op[1])
                ttl = int(op[2])
                await self._redis.expire(key, ttl)
                results.append(True)

        self._ops.clear()

        return results


@pytest.mark.asyncio
async def test_apply_delta_requires_existing_hash() -> None:
    redis = _FakeRedis()
    cache = EngagementCache(redis)  # type: ignore[arg-type]

    assert await cache.apply_delta(7, field="sub_cnt", delta=1) is None


@pytest.mark.asyncio
async def test_apply_delta_increments_and_clamps() -> None:
    redis = _FakeRedis()
    cache = EngagementCache(redis)  # type: ignore[arg-type]

    await cache.set_many({7: empty_counts()})
    assert await cache.apply_delta(7, field="sub_cnt", delta=2) == 2
    assert await cache.apply_delta(7, field="sub_cnt", delta=-5) == 0


@pytest.mark.asyncio
async def test_mark_dirty_debounced_schedules_once() -> None:
    redis = _FakeRedis()
    cache = EngagementCache(redis)  # type: ignore[arg-type]

    first = await cache.mark_dirty_debounced([3, 3, 4])
    second = await cache.mark_dirty_debounced([3, 4])

    assert sorted(first) == [3, 4]
    assert second == []
    claimed = await cache.claim_dirty()
    assert sorted(claimed) == [3, 4]
