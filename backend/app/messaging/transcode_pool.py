"""Fixed-size pool for concurrent ffmpeg processes.

All encode work units (full-rendition or per-chunk) acquire a slot from this
pool so multiple uploads cannot spawn unbounded ffmpeg processes.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import TypeVar

from app.config import settings

_logger = logging.getLogger("uvicorn.error")

T = TypeVar("T")


@dataclass
class _PoolState:
    semaphore: asyncio.Semaphore | None = None
    size: int = 0


_POOL = _PoolState()


def _max_slots() -> int:
    return max(1, int(settings.transcode_max_ffmpeg))


def get_transcode_semaphore() -> asyncio.Semaphore:
    """Return the process-wide ffmpeg concurrency gate."""

    size = _max_slots()

    if _POOL.semaphore is None or _POOL.size != size:
        _POOL.semaphore = asyncio.Semaphore(size)
        _POOL.size = size
        _logger.info("transcode pool ready max_ffmpeg=%s", size)

    return _POOL.semaphore


async def run_in_transcode_pool(
    work: Callable[[], Awaitable[T]],
    *,
    label: str = "ffmpeg",
) -> T:
    """Run ``work`` after acquiring a global ffmpeg slot."""

    sem = get_transcode_semaphore()
    _logger.debug("transcode pool acquire label=%s", label)
    async with sem:
        _logger.debug("transcode pool running label=%s", label)

        return await work()
