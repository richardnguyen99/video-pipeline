"""Unit tests for watch-event archive buffering and flushing."""

from __future__ import annotations

import gzip
from dataclasses import dataclass, field
from typing import BinaryIO

import pytest

from app.messaging.watch_event_archive import WatchEventArchiver


@dataclass
class _UploadedObject:
    key: str
    content_type: str | None
    data: bytes


@dataclass
class _FakeStorage:
    uploads: list[_UploadedObject] = field(default_factory=list)

    async def upload_fileobj(
        self,
        *,
        object_key: str,
        fileobj: BinaryIO,
        content_type: str | None = None,
    ) -> str:
        self.uploads.append(
            _UploadedObject(
                key=object_key,
                content_type=content_type,
                data=fileobj.read(),
            ),
        )

        return f"http://storage.local/{object_key}"


@pytest.mark.asyncio
async def test_flush_now_uploads_gzipped_tsv_batch() -> None:
    """Buffered events are flushed as one compressed TSV object."""

    storage = _FakeStorage()
    archiver = WatchEventArchiver(
        storage=storage,  # type: ignore[arg-type]
        flush_interval_seconds=1800,
        object_prefix="watch-events",
    )

    await archiver.append_event(
        {
            "event_type": "play_start",
            "playback_session_id": "session-1",
            "user_id": "user-1",
            "video_id": 59,
            "position_seconds": 0,
            "is_eligible": True,
            "watched_seconds_delta": 0,
            "timestamp": "2026-10-05T20:00:00Z",
        },
    )
    await archiver.append_event(
        {
            "event_type": "heartbeat",
            "playback_session_id": "session-1",
            "user_id": "user-1",
            "video_id": 59,
            "position_seconds": 15.2,
            "is_eligible": True,
            "watched_seconds_delta": 10.0,
            "timestamp": "2026-10-05T20:00:10Z",
        },
    )

    await archiver.flush_now()

    assert len(storage.uploads) == 1
    uploaded = storage.uploads[0]
    assert uploaded.key.startswith("watch-events/")
    assert uploaded.key.endswith(".tsv.gz")
    assert uploaded.content_type == "application/gzip"

    tsv = gzip.decompress(uploaded.data).decode("utf-8")
    lines = tsv.strip().splitlines()
    assert len(lines) == 3
    assert lines[0].startswith("received_at\tevent_type\tplayback_session_id")
    assert "\tplay_start\tsession-1\tuser-1\t59\t0\ttrue\t0\t" in lines[1]
    assert "\theartbeat\tsession-1\tuser-1\t59\t15.2\ttrue\t10.0\t" in lines[2]
