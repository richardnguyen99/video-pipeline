"""Unit tests for ``app.services.engagement_cache`` helpers."""

from __future__ import annotations

from typing import Any

import pytest

from app.messaging.engagement_cache import empty_counts
from app.services.engagement_cache import (
    EngagementCacheService,
    _unique_positive_ids,
    notify_like_count_delta,
    notify_sub_count_delta,
)


def test_unique_positive_ids_dedupes_and_filters() -> None:
    assert _unique_positive_ids([3, 0, 3, -1, 2, 2]) == [3, 2]


@pytest.mark.asyncio
async def test_get_counts_falls_back_to_repository(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When Redis is unavailable, counts come from the repository aggregates."""

    class _Repo:
        session: Any = None
        calls: list[list[int]] = []

        async def count_engagement_for_actresses(
            self,
            actress_ids: list[int],
        ) -> dict[int, dict[str, int]]:
            self.calls.append(list(actress_ids))

            return {
                1: {
                    "video_cnt": 5,
                    "sub_cnt": 2,
                    "view_cnt": 10,
                    "like_cnt": 1,
                    "comment_cnt": 0,
                },
            }

    async def _no_redis() -> None:
        raise ConnectionError("offline")

    monkeypatch.setattr(
        "app.services.engagement_cache.get_engagement_cache",
        _no_redis,
    )

    repo = _Repo()
    service = EngagementCacheService(
        session=None,  # type: ignore[arg-type]
        repository=repo,
    )
    result = await service.get_counts([1, 1, 0])

    assert result[1]["video_cnt"] == 5
    assert result[1]["sub_cnt"] == 2
    assert repo.calls == [[1]]


@pytest.mark.asyncio
async def test_notify_helpers_noop_on_zero_delta(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Zero deltas must not touch Redis or the queue."""

    called: list[str] = []

    async def _fail_cache() -> None:
        called.append("cache")
        raise AssertionError("should not open cache")

    monkeypatch.setattr(
        "app.services.engagement_cache.get_engagement_cache",
        _fail_cache,
    )

    await notify_sub_count_delta(
        session=None,  # type: ignore[arg-type]
        actress_id=1,
        delta=0,
    )
    await notify_like_count_delta(
        session=None,  # type: ignore[arg-type]
        actress_ids=[1],
        delta=0,
    )

    assert called == []


@pytest.mark.asyncio
async def test_empty_counts_shape() -> None:
    counts = empty_counts()

    assert set(counts) == {
        "video_cnt",
        "sub_cnt",
        "view_cnt",
        "like_cnt",
        "comment_cnt",
    }
    assert all(value == 0 for value in counts.values())
