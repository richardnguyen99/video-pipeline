"""Application service for engagement read-through and write-behind."""

# pylint: disable=broad-exception-caught

from __future__ import annotations

import logging
from typing import Optional, Protocol

from sqlmodel.ext.asyncio.session import AsyncSession

from app.messaging.engagement_cache import (
    EngagementCache,
    empty_counts,
    get_engagement_cache,
)
from app.messaging.rabbitmq import publish_engagement_flush
from app.models.actress_engagement_stats import ActressEngagementStats
from app.repositories.actress import ActressRepository


class _EngagementCountRepository(Protocol):
    """Minimal repository surface used for aggregate engagement reads."""

    async def count_engagement_for_actresses(
        self,
        actress_ids: list[int],
    ) -> dict[int, dict[str, int]]:
        """Return engagement counters keyed by actress id."""


_logger = logging.getLogger("uvicorn.error")


def _unique_positive_ids(actress_ids: list[int]) -> list[int]:
    """Return distinct positive actress ids in first-seen order."""

    unique_ids: list[int] = []
    seen: set[int] = set()

    for actress_id in actress_ids:
        if actress_id < 1 or actress_id in seen:
            continue

        seen.add(actress_id)
        unique_ids.append(actress_id)

    return unique_ids


def _counts_from_stats_row(row: ActressEngagementStats) -> dict[str, int]:
    """Map a denormalized stats row to the public counter dict."""

    return {
        "video_cnt": row.video_cnt,
        "sub_cnt": row.sub_cnt,
        "view_cnt": row.view_cnt,
        "like_cnt": row.like_cnt,
        "comment_cnt": row.comment_cnt,
    }


class EngagementCacheService:
    """Orchestrates Redis counters, denormalized stats, and flush signals."""

    def __init__(
        self,
        session: AsyncSession,
        repository: Optional[_EngagementCountRepository] = None,
    ) -> None:
        self._session = session
        self._repository: _EngagementCountRepository = (
            repository
            if repository is not None
            else ActressRepository(session)
        )

    def _can_use_stats_table(self) -> bool:
        """Return whether the bound session can run stats queries."""

        session = self._session

        return session is not None and hasattr(session, "execute")

    async def get_counts(
        self,
        actress_ids: list[int],
    ) -> dict[int, dict[str, int]]:
        """Read-through engagement counters for many actress ids."""

        unique_ids = _unique_positive_ids(actress_ids)

        if not unique_ids:
            return {}

        result, missing, cache = await self._read_redis(unique_ids)

        if not missing:
            return result

        seed = await self._fill_from_stats(result, missing)
        still_missing = [
            actress_id for actress_id in missing if actress_id not in result
        ]

        if still_missing:
            seed.update(
                await self._fill_from_aggregates(result, still_missing),
            )

        await self._seed_redis(cache, seed)

        return result

    async def _read_redis(
        self,
        unique_ids: list[int],
    ) -> tuple[
        dict[int, dict[str, int]], list[int], Optional[EngagementCache]
    ]:
        """Load hits from Redis; return misses and the cache handle."""

        result: dict[int, dict[str, int]] = {}

        try:
            cache = await get_engagement_cache()
            cached = await cache.get_many(unique_ids)
        except Exception as exc:
            _logger.warning(
                "engagement redis read failed; falling back (%s)",
                exc,
            )

            return result, list(unique_ids), None

        missing: list[int] = []

        for actress_id in unique_ids:
            hit = cached.get(actress_id)

            if hit is None:
                missing.append(actress_id)
            else:
                result[actress_id] = hit

        return result, missing, cache

    async def _fill_from_stats(
        self,
        result: dict[int, dict[str, int]],
        missing: list[int],
    ) -> dict[int, dict[str, int]]:
        """Fill gaps from the denormalized stats table."""

        seed: dict[int, dict[str, int]] = {}

        if not self._can_use_stats_table():
            return seed

        try:
            stats_rows = await ActressEngagementStats.get_many(
                self._session,
                missing,
            )
        except Exception as exc:
            _logger.warning(
                "engagement stats read failed; using aggregates (%s)",
                exc,
            )

            return seed

        for actress_id in missing:
            row = stats_rows.get(actress_id)

            if row is None:
                continue

            counts = _counts_from_stats_row(row)
            result[actress_id] = counts
            seed[actress_id] = counts

        return seed

    async def _fill_from_aggregates(
        self,
        result: dict[int, dict[str, int]],
        still_missing: list[int],
    ) -> dict[int, dict[str, int]]:
        """Compute remaining counts from source tables and upsert stats."""

        seed: dict[int, dict[str, int]] = {}
        computed = await self._repository.count_engagement_for_actresses(
            still_missing,
        )

        for actress_id in still_missing:
            counts = computed.get(actress_id, empty_counts())
            result[actress_id] = counts
            seed[actress_id] = counts
            await self._upsert_stats_row(actress_id, counts)

        return seed

    async def _upsert_stats_row(
        self,
        actress_id: int,
        counts: dict[str, int],
    ) -> None:
        """Persist one denormalized stats row; log and continue on failure."""

        if not self._can_use_stats_table():
            return

        try:
            await ActressEngagementStats.upsert(
                self._session,
                actress_id=actress_id,
                video_cnt=counts.get("video_cnt", 0),
                sub_cnt=counts.get("sub_cnt", 0),
                view_cnt=counts.get("view_cnt", 0),
                like_cnt=counts.get("like_cnt", 0),
                comment_cnt=counts.get("comment_cnt", 0),
            )
        except Exception as exc:
            _logger.warning(
                "engagement stats upsert failed actress_id=%s (%s)",
                actress_id,
                exc,
            )

    async def _seed_redis(
        self,
        cache: Optional[EngagementCache],
        seed: dict[int, dict[str, int]],
    ) -> None:
        """Write-through resolved counts into Redis when available."""

        if not seed or cache is None:
            return

        try:
            await cache.set_many(seed)
        except Exception:
            _logger.exception("engagement redis seed failed")

    async def apply_field_delta(
        self,
        actress_ids: list[int],
        *,
        field: str,
        delta: int,
    ) -> None:
        """Write-through a counter delta and schedule a debounced flush."""

        if delta == 0 or not actress_ids:
            return

        unique_ids = sorted(
            {actress_id for actress_id in actress_ids if actress_id > 0},
        )

        try:
            cache = await get_engagement_cache()
        except Exception:
            _logger.exception("engagement redis unavailable for write-through")

            return

        for actress_id in unique_ids:
            await self._apply_one_delta(cache, actress_id, field, delta)

        await self._schedule_flush(unique_ids)

    async def _apply_one_delta(
        self,
        cache: EngagementCache,
        actress_id: int,
        field: str,
        delta: int,
    ) -> None:
        """Apply a single-actress counter delta with seed-on-miss."""

        try:
            new_value = await cache.apply_delta(
                actress_id,
                field=field,
                delta=delta,
            )

            if new_value is not None:
                return

            counts = await self.get_counts([actress_id])
            current = counts.get(actress_id, empty_counts())
            current[field] = max(0, int(current.get(field, 0)) + delta)
            await cache.set_many({actress_id: current})
        except Exception:
            _logger.exception(
                "engagement write-through failed actress_id=%s",
                actress_id,
            )

    async def _schedule_flush(self, actress_ids: list[int]) -> None:
        """Mark ids dirty and publish one flush signal per debounce window."""

        try:
            cache = await get_engagement_cache()
            scheduled = await cache.mark_dirty_debounced(actress_ids)
        except Exception:
            _logger.exception("engagement debounce mark failed")

            return

        if not scheduled:
            return

        try:
            await publish_engagement_flush(
                {
                    "actress_ids": scheduled,
                    "reason": "debounced_write",
                },
            )
        except Exception:
            _logger.exception(
                "failed to publish engagement flush ids=%s",
                scheduled,
            )


async def notify_sub_count_delta(
    session: AsyncSession,
    *,
    actress_id: int,
    delta: int,
) -> None:
    """Helper used by subscribe routes after membership changes."""

    service = EngagementCacheService(session)
    await service.apply_field_delta(
        [actress_id],
        field="sub_cnt",
        delta=delta,
    )


async def notify_like_count_delta(
    session: AsyncSession,
    *,
    actress_ids: list[int],
    delta: int,
) -> None:
    """Helper used by video reaction routes after like polarity changes."""

    service = EngagementCacheService(session)
    await service.apply_field_delta(
        actress_ids,
        field="like_cnt",
        delta=delta,
    )
