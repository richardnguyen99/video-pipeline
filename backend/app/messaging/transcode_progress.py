"""Live transcode progress in Redis (hot path); Postgres holds durable events."""

from __future__ import annotations

import json
import logging
import uuid
from collections.abc import Mapping
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Optional

from redis.exceptions import RedisError

from app.messaging.redis_client import get_redis_client

_logger = logging.getLogger("uvicorn.error")

# Soft-fail when Redis is down or the client is bound to a closed event loop.
_REDIS_SOFT_ERRORS = (RedisError, OSError, RuntimeError)

_PROGRESS_KEY = "transcode:progress:{public_id}"
_PROGRESS_CHANNEL = "transcode:progress:ch:{public_id}"
_PROGRESS_TTL_S = 86_400
_PUBSUB_POLL_S = 1.0


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).replace(tzinfo=None).isoformat()


def _as_int(value: object, default: int = 0) -> int:
    if isinstance(value, bool):
        return default

    if isinstance(value, int):
        return value

    if isinstance(value, float):
        return int(value)

    if isinstance(value, (str, bytes, bytearray)):
        try:
            return int(value)
        except ValueError:
            return default

    return default


def _as_optional_int(value: object) -> Optional[int]:
    if value is None:
        return None

    return _as_int(value, default=0) if not isinstance(value, bool) else None


def _as_float(value: object, default: float = 0.0) -> float:
    if isinstance(value, bool):
        return default

    if isinstance(value, (int, float)):
        return float(value)

    if isinstance(value, (str, bytes, bytearray)):
        try:
            return float(value)
        except ValueError:
            return default

    return default


def _hash_as_str_dict(data: Mapping[Any, Any]) -> dict[str, str]:
    return {str(key): str(val) for key, val in data.items()}


def _parse_rung_item(item: object) -> Optional[RungProgressSnapshot]:
    if not isinstance(item, dict):
        return None

    label = item.get("label")

    if not isinstance(label, str) or not label:
        return None

    playlist_raw = item.get("playlist_key")
    playlist_key = str(playlist_raw) if playlist_raw else None

    return RungProgressSnapshot(
        label=label,
        width=_as_int(item.get("width")),
        height=_as_int(item.get("height")),
        video_kbps=_as_int(item.get("video_kbps")),
        status=str(item.get("status") or "PENDING"),
        progress_pct=_as_int(item.get("progress_pct")),
        segment_count=_as_optional_int(item.get("segment_count")),
        playlist_key=playlist_key,
    )


def _parse_rungs(raw: object) -> list[RungProgressSnapshot]:
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError:
            return []

    if not isinstance(raw, list):
        return []

    rungs: list[RungProgressSnapshot] = []

    for item in raw:
        parsed = _parse_rung_item(item)

        if parsed is not None:
            rungs.append(parsed)

    return rungs


def _snapshot_from_public_dict(
    payload: dict[str, Any],
) -> TranscodeProgressSnapshot:
    return TranscodeProgressSnapshot(
        status=str(payload.get("status") or "ENCODING"),
        overall_pct=_as_float(payload.get("overall_pct")),
        message=str(payload.get("message") or ""),
        updated_at=str(payload.get("updated_at") or _utcnow_iso()),
        rungs=_parse_rungs(payload.get("rungs")),
    )


@dataclass
class RungProgressSnapshot:
    """One ladder rung as exposed to the Process wizard."""

    label: str
    width: int
    height: int
    video_kbps: int
    status: str
    progress_pct: int = 0
    segment_count: Optional[int] = None
    playlist_key: Optional[str] = None


@dataclass
class TranscodeProgressSnapshot:
    """Full live progress document stored in Redis and pushed on Pub/Sub."""

    status: str
    overall_pct: float = 0.0
    message: str = ""
    updated_at: str = field(default_factory=_utcnow_iso)
    rungs: list[RungProgressSnapshot] = field(default_factory=list)

    def to_mapping(
        self,
    ) -> (
        Mapping[
            bytes | bytearray | memoryview[int] | str | int | float,
            bytes | bytearray | memoryview[int] | str | int | float,
        ]
        | None
    ):
        return {
            "status": self.status,
            "overall_pct": f"{self.overall_pct:.2f}",
            "message": self.message,
            "updated_at": self.updated_at,
            "rungs": json.dumps([asdict(rung) for rung in self.rungs]),
        }

    def to_public_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "overall_pct": self.overall_pct,
            "message": self.message,
            "updated_at": self.updated_at,
            "rungs": [asdict(rung) for rung in self.rungs],
        }

    @classmethod
    def from_redis_hash(
        cls,
        data: dict[str, str],
    ) -> Optional[TranscodeProgressSnapshot]:
        if not data:
            return None

        status = data.get("status")

        if not status:
            return None

        return cls(
            status=status,
            overall_pct=_as_float(data.get("overall_pct") or "0"),
            message=str(data.get("message") or ""),
            updated_at=str(data.get("updated_at") or _utcnow_iso()),
            rungs=_parse_rungs(data.get("rungs") or "[]"),
        )


def progress_key(public_id: uuid.UUID) -> str:
    return _PROGRESS_KEY.format(public_id=public_id)


def progress_channel(public_id: uuid.UUID) -> str:
    return _PROGRESS_CHANNEL.format(public_id=public_id)


async def set_progress_snapshot(
    public_id: uuid.UUID,
    snapshot: TranscodeProgressSnapshot,
) -> None:
    """Write the full snapshot to Redis and publish for SSE subscribers."""

    snapshot.updated_at = _utcnow_iso()

    try:
        redis = await get_redis_client()
        key = progress_key(public_id)
        mapping = snapshot.to_mapping()
        await redis.hset(key, mapping=mapping)
        await redis.expire(key, _PROGRESS_TTL_S)
        await redis.publish(
            progress_channel(public_id),
            json.dumps(snapshot.to_public_dict()),
        )
    except _REDIS_SOFT_ERRORS:
        _logger.debug("transcode progress redis write failed", exc_info=True)


async def get_progress_snapshot(
    public_id: uuid.UUID,
) -> Optional[TranscodeProgressSnapshot]:
    """Return the live snapshot, or None when Redis has no entry."""

    try:
        redis = await get_redis_client()
        data = await redis.hgetall(progress_key(public_id))
    except _REDIS_SOFT_ERRORS:
        _logger.debug("transcode progress redis read failed", exc_info=True)

        return None

    if not data:
        return None

    return TranscodeProgressSnapshot.from_redis_hash(_hash_as_str_dict(data))


def _snapshot_from_pubsub_message(
    message: dict[str, Any],
) -> Optional[TranscodeProgressSnapshot]:
    raw = message.get("data")

    if not isinstance(raw, str) or not raw:
        return None

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return None

    if not isinstance(payload, dict):
        return None

    return _snapshot_from_public_dict(payload)


async def _close_pubsub(pubsub: Any, channel: str) -> None:
    try:
        await pubsub.unsubscribe(channel)
        await pubsub.aclose()
    except _REDIS_SOFT_ERRORS:
        _logger.debug("transcode progress pubsub close failed", exc_info=True)


async def iter_progress_events(
    public_id: uuid.UUID,
) -> AsyncIterator[TranscodeProgressSnapshot]:
    """Yield the current snapshot, then each Pub/Sub update until cancelled."""

    initial = await get_progress_snapshot(public_id)

    if initial is not None:
        yield initial

    redis = await get_redis_client()
    pubsub = redis.pubsub()
    channel = progress_channel(public_id)

    try:
        await pubsub.subscribe(channel)

        while True:
            message = await pubsub.get_message(
                ignore_subscribe_messages=True,
                timeout=_PUBSUB_POLL_S,
            )

            if message is None:
                continue

            snapshot = _snapshot_from_pubsub_message(message)

            if snapshot is None:
                continue

            yield snapshot
    finally:
        await _close_pubsub(pubsub, channel)
