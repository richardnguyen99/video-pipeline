"""In-memory watch-event buffering and periodic TSV archive uploads."""

from __future__ import annotations

import asyncio
import csv
import datetime
import gzip
import io
import logging
import time
import uuid
from collections import defaultdict
from typing import Any, Optional

from redis.asyncio import Redis

from app.config import settings
from app.messaging.redis_client import get_redis_client
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
_LOCK_SCRIPT = """
if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
end
return 0
"""
_LOCK_RETRY_ATTEMPTS = 8
_LOCK_RETRY_DELAY_SECONDS = 0.1
_LOCK_TTL_SECONDS = 120


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
        lock_redis: Optional[Redis] = None,
    ) -> None:
        self._storage = storage
        self._flush_interval_seconds = max(1, flush_interval_seconds)
        self._object_prefix = (
            object_prefix.strip().strip("/") or "watch-events"
        )
        self._rows: list[dict[str, str]] = []
        self._lock = asyncio.Lock()
        self._flush_lock = asyncio.Lock()
        self._stop_event: Optional[asyncio.Event] = None
        self._task: Optional[asyncio.Task[None]] = None
        self._lock_redis = lock_redis

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

        async with self._flush_lock:
            async with self._lock:
                if not self._rows:
                    return

                rows = self._rows
                self._rows = []

            grouped_rows = self._group_rows_by_window(rows)
            failed_rows: list[dict[str, str]] = []

            for window_start in sorted(grouped_rows):
                window_rows = grouped_rows[window_start]
                success = await self._flush_window_rows(
                    window_start=window_start,
                    rows=window_rows,
                )

                if not success:
                    failed_rows.extend(window_rows)

            if failed_rows:
                async with self._lock:
                    self._rows = failed_rows + self._rows

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

    async def _flush_window_rows(
        self,
        *,
        window_start: datetime.datetime,
        rows: list[dict[str, str]],
    ) -> bool:
        """Append rows into the single archive object for a time window."""

        owner_token = uuid.uuid4().hex
        lock_key = self._lock_key(window_start)
        redis = await self._get_lock_redis()
        acquired = await self._acquire_lock(
            redis=redis,
            lock_key=lock_key,
            owner_token=owner_token,
        )

        if not acquired:
            _LOGGER.warning(
                "Could not acquire watch archive lock lock_key=%s row_count=%s",
                lock_key,
                len(rows),
            )

            return False

        object_key = self._object_key(window_start)

        try:
            existing_rows = await self._load_existing_rows(object_key)
            merged_rows = existing_rows + rows
            tsv = self._to_tsv(merged_rows)
            compressed = gzip.compress(tsv.encode("utf-8"))
            await self._storage.upload_fileobj(
                object_key=object_key,
                fileobj=io.BytesIO(compressed),
                content_type="application/gzip",
            )
        except Exception:  # pylint: disable=W0718
            _LOGGER.exception(
                "Failed to append watch events to window archive key=%s "
                "window_start=%s row_count=%s",
                object_key,
                window_start.isoformat(),
                len(rows),
            )

            return False
        finally:
            await self._release_lock(
                redis=redis,
                lock_key=lock_key,
                owner_token=owner_token,
            )

        _LOGGER.info(
            "Archived watch events key=%s added_rows=%s total_rows=%s",
            object_key,
            len(rows),
            len(merged_rows),
        )

        return True

    async def _load_existing_rows(
        self,
        object_key: str,
    ) -> list[dict[str, str]]:
        """Load already archived rows from object storage for one window."""

        existing_bytes = await self._storage.download_bytes(
            object_key=object_key,
        )

        if existing_bytes is None:
            return []

        try:
            tsv = gzip.decompress(existing_bytes).decode("utf-8")
        except Exception as exc:  # pylint: disable=W0718
            raise ValueError(
                f"Invalid gzip archive content for key {object_key}",
            ) from exc

        return self._parse_tsv_rows(tsv)

    async def _get_lock_redis(self) -> Redis:
        """Return the Redis client used for distributed archive locks."""

        if self._lock_redis is not None:
            return self._lock_redis

        self._lock_redis = await get_redis_client()

        return self._lock_redis

    async def _acquire_lock(
        self,
        *,
        redis: Redis,
        lock_key: str,
        owner_token: str,
    ) -> bool:
        """Try to acquire a short-lived distributed lock."""

        for _ in range(_LOCK_RETRY_ATTEMPTS):
            acquired = await redis.set(
                lock_key,
                owner_token,
                nx=True,
                ex=_LOCK_TTL_SECONDS,
            )

            if bool(acquired):
                return True

            await asyncio.sleep(_LOCK_RETRY_DELAY_SECONDS)

        return False

    async def _release_lock(
        self,
        *,
        redis: Redis,
        lock_key: str,
        owner_token: str,
    ) -> None:
        """Release a distributed lock only when still owned by this process."""

        try:
            await redis.eval(
                _LOCK_SCRIPT,
                1,
                lock_key,
                owner_token,
            )
        except Exception:  # pylint: disable=W0718
            _LOGGER.exception(
                "Failed to release watch archive lock lock_key=%s",
                lock_key,
            )

    def _group_rows_by_window(
        self,
        rows: list[dict[str, str]],
    ) -> dict[datetime.datetime, list[dict[str, str]]]:
        """Bucket buffered rows into archive windows."""

        grouped: dict[datetime.datetime, list[dict[str, str]]] = defaultdict(
            list
        )

        for row in rows:
            window_start = self._window_start_from_received_at(
                row.get("received_at", ""),
            )
            grouped[window_start].append(row)

        return grouped

    def _window_start_from_received_at(
        self,
        received_at: str,
    ) -> datetime.datetime:
        """Return the aligned flush window start for one row."""

        try:
            normalized = received_at.replace("Z", "+00:00")
            received_dt = datetime.datetime.fromisoformat(normalized)

            if received_dt.tzinfo is None:
                received_dt = received_dt.replace(
                    tzinfo=datetime.timezone.utc,
                )
            else:
                received_dt = received_dt.astimezone(datetime.timezone.utc)
        except ValueError:
            received_dt = datetime.datetime.now(datetime.timezone.utc)

        window_start_epoch = (
            int(received_dt.timestamp()) // self._flush_interval_seconds
        ) * self._flush_interval_seconds

        return datetime.datetime.fromtimestamp(
            window_start_epoch,
            tz=datetime.timezone.utc,
        )

    def _seconds_until_next_flush(self) -> float:
        """Return seconds until the next aligned flush boundary."""

        now = time.time()
        interval = float(self._flush_interval_seconds)
        next_boundary = ((now // interval) + 1.0) * interval

        return max(0.1, next_boundary - now)

    def _parse_tsv_rows(self, tsv: str) -> list[dict[str, str]]:
        """Parse TSV text into archive row dictionaries."""

        if not tsv.strip():
            return []

        reader = csv.DictReader(
            io.StringIO(tsv),
            delimiter="\t",
        )
        rows: list[dict[str, str]] = []

        for row in reader:
            rows.append(
                {
                    column: row.get(column, "") or ""
                    for column in _ARCHIVE_COLUMNS
                },
            )

        return rows

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
                [row.get(column, "") for column in _ARCHIVE_COLUMNS],
            )

        return out.getvalue()

    def _lock_key(self, window_start: datetime.datetime) -> str:
        """Build the Redis lock key for one archive window."""

        window_stamp = window_start.strftime("%Y%m%dT%H%M%SZ")
        prefix = self._object_prefix.replace("/", "_")

        return f"watch:archive-lock:{prefix}:{window_stamp}"

    def _object_key(self, window_start: datetime.datetime) -> str:
        """Build the single archive object key for one time window."""

        window_stamp = window_start.strftime("%Y%m%dT%H%M%SZ")
        date_path = window_start.strftime("%Y/%m/%d")

        return (
            f"{self._object_prefix}/{date_path}/"
            f"watch-events-{window_stamp}.tsv.gz"
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
