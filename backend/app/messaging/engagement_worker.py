"""Write-behind worker: flush debounced engagement updates to PostgreSQL."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from app.config import settings
from app.database import async_session_factory
from app.messaging.engagement_cache import (
    empty_counts,
    get_engagement_cache,
)
from app.models.actress_engagement_stats import ActressEngagementStats
from app.repositories.actress import ActressRepository

_logger = logging.getLogger("uvicorn.error")


async def process_engagement_flush_message(payload: dict[str, Any]) -> None:
    """Handle a debounced flush signal from the engagement queue.

    Waits out the debounce window so rapid clicks coalesce, then recomputes
    counts from source tables and writes both the stats table and Redis.
    """

    _ = payload
    await asyncio.sleep(settings.engagement_debounce_seconds)
    await flush_dirty_engagement()


async def flush_dirty_engagement(*, limit: int = 200) -> int:
    """Recompute and persist engagement for claimed dirty actress ids.

    Returns:
        Number of actress ids successfully flushed.
    """

    cache = await get_engagement_cache()
    actress_ids = await cache.claim_dirty(limit=limit)

    if not actress_ids:
        return 0

    try:
        async with async_session_factory() as session:
            repository = ActressRepository(session)
            computed = await repository.count_engagement_for_actresses(
                actress_ids,
            )

            for actress_id in actress_ids:
                counts = computed.get(actress_id, empty_counts())
                await ActressEngagementStats.upsert(
                    session,
                    actress_id=actress_id,
                    video_cnt=counts.get("video_cnt", 0),
                    sub_cnt=counts.get("sub_cnt", 0),
                    view_cnt=counts.get("view_cnt", 0),
                    like_cnt=counts.get("like_cnt", 0),
                    comment_cnt=counts.get("comment_cnt", 0),
                )

            await cache.set_many(
                {
                    actress_id: computed.get(actress_id, empty_counts())
                    for actress_id in actress_ids
                },
            )
    except Exception:
        _logger.exception(
            "engagement write-behind flush failed ids=%s",
            actress_ids,
        )
        await cache.requeue_dirty(actress_ids)
        raise

    _logger.info(
        "engagement write-behind flushed count=%s ids=%s",
        len(actress_ids),
        actress_ids[:20],
    )

    return len(actress_ids)
