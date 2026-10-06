"""Tests for watch-event archival buffering and windowed compaction."""

from __future__ import annotations

import asyncio
import csv
import gzip
import io
from typing import cast

import pytest
from redis.asyncio import Redis

from app.messaging.watch_event_archive import WatchEventArchiver
from app.storage.client import ObjectStorageClient


class _FakeStorageClient:
    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}
        self.uploads: list[tuple[str, bytes]] = []

    async def upload_fileobj(
        self,
        *,
        object_key: str,
        fileobj,
        content_type: str,
    ) -> None:
        _ = content_type

        body = fileobj.read()
        self.objects[object_key] = body
        self.uploads.append((object_key, body))

    async def download_bytes(self, *, object_key: str) -> bytes | None:
        return self.objects.get(object_key)


class _FakeRedisLockClient:
    def __init__(self) -> None:
        self._store: dict[str, str] = {}
        self._lock = asyncio.Lock()

    async def set(
        self,
        key: str,
        value: str,
        nx: bool,
        ex: int,
    ) -> bool | None:
        _ = ex

        async with self._lock:
            if nx and key in self._store:

                return None

            self._store[key] = value

        return True

    async def eval(
        self,
        script: str,
        numkeys: int,
        key: str,
        owner_token: str,
    ) -> int:
        _ = script
        _ = numkeys

        async with self._lock:
            if self._store.get(key) == owner_token:
                del self._store[key]

                return 1

        return 0


def _make_archiver(
    storage: _FakeStorageClient,
    lock_redis: _FakeRedisLockClient,
    *,
    object_prefix: str = "watch-events/test",
) -> WatchEventArchiver:
    """Build an archiver with typed fakes for mypy."""

    return WatchEventArchiver(
        storage=cast(ObjectStorageClient, storage),
        flush_interval_seconds=1800,
        object_prefix=object_prefix,
        lock_redis=cast(Redis, lock_redis),
    )


def _row_count_from_gzip_tsv(blob: bytes) -> int:
    text = gzip.decompress(blob).decode("utf-8")
    reader = csv.DictReader(io.StringIO(text), delimiter="\t")
    return sum(1 for _ in reader)


@pytest.mark.asyncio
async def test_flush_now_uploads_gzipped_tsv_batch() -> None:
    storage = _FakeStorageClient()
    lock_redis = _FakeRedisLockClient()
    archiver = _make_archiver(storage, lock_redis)

    await archiver.append_event(
        {
            "event_type": "heartbeat",
            "playback_session_id": "session-a",
            "user_id": "user-1",
            "video_id": 59,
            "position_seconds": 10.5,
            "is_eligible": True,
            "watched_seconds_delta": 10.5,
            "timestamp": "2026-10-05T19:35:13Z",
        },
    )

    await archiver.flush_now()

    assert len(storage.objects) == 1
    object_key, data = next(iter(storage.objects.items()))
    assert object_key.startswith("watch-events/test/")
    assert object_key.endswith(".tsv.gz")
    assert _row_count_from_gzip_tsv(data) == 1


@pytest.mark.asyncio
async def test_sequential_flushes_merge_into_single_window_file() -> None:
    storage = _FakeStorageClient()
    lock_redis = _FakeRedisLockClient()
    archiver = _make_archiver(storage, lock_redis)

    await archiver.append_event(
        {
            "event_type": "heartbeat",
            "playback_session_id": "session-a",
            "user_id": "user-1",
            "video_id": 59,
            "position_seconds": 10.0,
            "is_eligible": False,
            "watched_seconds_delta": 10.0,
            "timestamp": "2026-10-05T19:35:13Z",
        },
    )
    await archiver.flush_now()

    await archiver.append_event(
        {
            "event_type": "heartbeat",
            "playback_session_id": "session-a",
            "user_id": "user-1",
            "video_id": 59,
            "position_seconds": 20.0,
            "is_eligible": True,
            "watched_seconds_delta": 10.0,
            "timestamp": "2026-10-05T19:35:23Z",
        },
    )
    await archiver.flush_now()

    assert len(storage.objects) == 1
    _, data = next(iter(storage.objects.items()))
    assert _row_count_from_gzip_tsv(data) == 2


@pytest.mark.asyncio
async def test_concurrent_archivers_merge_into_single_window_file() -> None:
    storage = _FakeStorageClient()
    lock_redis = _FakeRedisLockClient()
    archiver_a = _make_archiver(storage, lock_redis)
    archiver_b = _make_archiver(storage, lock_redis)

    for i in range(25):
        await archiver_a.append_event(
            {
                "event_type": "heartbeat",
                "playback_session_id": f"session-a-{i}",
                "user_id": "user-a",
                "video_id": 59,
                "position_seconds": float(i),
                "is_eligible": False,
                "watched_seconds_delta": 10.0,
                "timestamp": "2026-10-05T19:35:13Z",
            },
        )
        await archiver_b.append_event(
            {
                "event_type": "heartbeat",
                "playback_session_id": f"session-b-{i}",
                "user_id": "user-b",
                "video_id": 59,
                "position_seconds": float(i + 25),
                "is_eligible": True,
                "watched_seconds_delta": 10.0,
                "timestamp": "2026-10-05T19:35:23Z",
            },
        )

    await asyncio.gather(
        archiver_a.flush_now(),
        archiver_b.flush_now(),
    )

    assert len(storage.objects) == 1
    _, data = next(iter(storage.objects.items()))
    assert _row_count_from_gzip_tsv(data) == 50
