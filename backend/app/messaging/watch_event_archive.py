"""In-memory watch-event buffering and periodic TSV archive uploads."""

from __future__ import annotations

import asyncio
import csv
import datetime
import gzip
import io
import logging
import time
from typing import Any, Optional

from app.config import settings
from app.storage.client import (
    ObjectStorageClient,
    get_object_storage_client,
)

_LOGGER = logging.getLogger("uvicorn.error")
_ARCHIVE_COLUMNS = [
    "received_at",
    "event_type",
    "playback_session_id",
    "user_id",
    "video_id",
    "position_seconds",
    "is_eligible",
    "watched_seconds_delta",
    "timestamp",
]


def _stringify(value: object) -> str:
    """Convert arbitrary payload values to TSV-safe strings."""

    if value is None:
        return ""

    if isinstance(value, bool):
        return "true" if value else "false"

    return str(value)


class WatchEventArchiver:
    """Buffers watch events and uploads periodic compressed TSV snapshots."""

    def __init__(
        self,
        *,
        storage: ObjectStorageClient,
        flush_interval_seconds: int,
        object_prefix: str,
    ) -> None:
        self._storage = storage
        self._flush_interval_seconds = max(1, flush_interval_seconds)
        self._object_prefix = (
            object_prefix.strip().strip("/") or "watch-events"
        )
        self._rows: list[dict[str, str]] = []
        self._lock = asyncio.Lock()
        self._stop_event: Optional[asyncio.Event] = None
        self._task: Optional[asyncio.Task[None]] = None

    async def start(self) -> None:
        """Start periodic archive flushing."""

        if self._task is not None and not self._task.done():
            return

        self._stop_event = asyncio.Event()
        self._task = asyncio.create_task(self._run_loop())
        _LOGGER.info(
            "Watch event archiver started interval_s=%s prefix=%s",
            self._flush_interval_seconds,
            self._object_prefix,
        )

    async def stop(self) -> None:
        """Stop periodic flushing and persist pending rows."""

        if self._task is None:
            return

        if self._stop_event is not None:
            self._stop_event.set()

        await self._task
        self._task = None
        self._stop_event = None
        await self.flush_now()
        _LOGGER.info("Watch event archiver stopped")

    async def append_event(self, payload: dict[str, Any]) -> None:
        """Append one watch event to the in-memory buffer."""

        received_at = datetime.datetime.now(
            datetime.timezone.utc,
        ).isoformat()
        row = {
            "received_at": received_at,
            "event_type": _stringify(payload.get("event_type")),
            "playback_session_id": _stringify(
                payload.get("playback_session_id"),
            ),
            "user_id": _stringify(payload.get("user_id")),
            "video_id": _stringify(payload.get("video_id")),
            "position_seconds": _stringify(payload.get("position_seconds")),
            "is_eligible": _stringify(payload.get("is_eligible")),
            "watched_seconds_delta": _stringify(
                payload.get("watched_seconds_delta"),
            ),
            "timestamp": _stringify(payload.get("timestamp")),
        }

        async with self._lock:
            self._rows.append(row)

    async def flush_now(self) -> None:
        """Flush pending rows to object storage immediately."""

        async with self._lock:
            if not self._rows:
                return

            rows = self._rows
            self._rows = []

        flush_time = datetime.datetime.now(datetime.timezone.utc)
        tsv = self._to_tsv(rows)
        compressed = gzip.compress(tsv.encode("utf-8"))
        key = self._object_key(flush_time)

        try:
            await self._storage.upload_fileobj(
                object_key=key,
                fileobj=io.BytesIO(compressed),
                content_type="application/gzip",
            )
        except Exception:  # pylint: disable=W0718
            async with self._lock:
                self._rows = rows + self._rows
            _LOGGER.exception(
                "Failed to archive watch events key=%s row_count=%s",
                key,
                len(rows),
            )

            return

        _LOGGER.info(
            "Archived watch events key=%s row_count=%s",
            key,
            len(rows),
        )

    async def _run_loop(self) -> None:
        """Flush the buffer at each interval boundary."""

        if self._stop_event is None:
            return

        while not self._stop_event.is_set():
            timeout = self._seconds_until_next_flush()

            try:
                await asyncio.wait_for(
                    self._stop_event.wait(),
                    timeout=timeout,
                )
            except asyncio.TimeoutError:
                await self.flush_now()

    def _seconds_until_next_flush(self) -> float:
        """Return seconds until the next aligned flush boundary."""

        now = time.time()
        interval = float(self._flush_interval_seconds)
        next_boundary = ((now // interval) + 1.0) * interval

        return max(0.1, next_boundary - now)

    def _to_tsv(self, rows: list[dict[str, str]]) -> str:
        """Serialize buffered rows to TSV content."""

        out = io.StringIO()
        writer = csv.writer(
            out,
            delimiter="\t",
            lineterminator="\n",
            quoting=csv.QUOTE_MINIMAL,
        )
        writer.writerow(_ARCHIVE_COLUMNS)

        for row in rows:
            writer.writerow(
                [row.get(column, "") for column in _ARCHIVE_COLUMNS]
            )

        return out.getvalue()

    def _object_key(self, flush_time: datetime.datetime) -> str:
        """Build a deterministic object key for one archived batch."""

        timestamp = flush_time.strftime("%Y%m%dT%H%M%SZ")
        millis = int(flush_time.microsecond / 1000)
        date_path = flush_time.strftime("%Y/%m/%d")

        return (
            f"{self._object_prefix}/{date_path}/"
            f"watch-events-{timestamp}-{millis:03d}.tsv.gz"
        )


_archiver: WatchEventArchiver = WatchEventArchiver(
    storage=get_object_storage_client(),
    flush_interval_seconds=settings.watch_events_flush_interval_seconds,
    object_prefix=settings.watch_events_object_prefix,
)


async def start_watch_event_archiver() -> None:
    """Start periodic watch-event archive flushing."""

    await _archiver.start()


async def stop_watch_event_archiver() -> None:
    """Stop periodic watch-event archive flushing."""

    await _archiver.stop()


async def buffer_watch_event(payload: dict[str, Any]) -> None:
    """Append one event payload to the watch-event archive buffer."""

    await _archiver.append_event(payload)
