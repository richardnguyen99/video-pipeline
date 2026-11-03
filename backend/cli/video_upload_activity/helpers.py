"""Shared helpers for activity backfill."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlmodel import col, select

from app.models.video import Video
from app.models.video_upload_activity import (
    VideoUploadActivity,
    VideoUploadActivityType,
)


def activity_row(
    *,
    video: Video,
    event_type: VideoUploadActivityType,
    message: str,
    created_at: datetime,
    metadata: dict[str, object] | None = None,
) -> VideoUploadActivity:
    """Build an activity row stamped with a historical timestamp."""

    assert video.public_id is not None

    return VideoUploadActivity(
        id=uuid.uuid4(),
        video_id=video.id,
        public_id=video.public_id,
        actor_id=video.uploader_id,
        event_type=event_type.value,
        message=message[:512],
        metadata_=metadata,
        created_at=created_at,
    )


async def existing_event_keys(
    session: Any,
    video_ids: list[int],
) -> set[tuple[int, str, str]]:
    """Return (video_id, event_type, message) already present for targets."""

    if not video_ids:
        return set()

    statement = select(
        col(VideoUploadActivity.video_id),
        col(VideoUploadActivity.event_type),
        col(VideoUploadActivity.message),
    ).where(col(VideoUploadActivity.video_id).in_(video_ids))
    rows = (await session.execute(statement)).all()

    return {(int(row[0]), str(row[1]), str(row[2])) for row in rows}


def should_write(
    existing: set[tuple[int, str, str]],
    *,
    video_id: int,
    event_type: VideoUploadActivityType,
    message: str,
) -> bool:
    """Skip when an identical event already exists for the video."""

    return (video_id, event_type.value, message[:512]) not in existing


def bucket_created_at(value: datetime | None, fallback: datetime) -> datetime:
    """Collapse timestamps to the second so batch inserts share one bucket."""

    stamp = value or fallback

    return stamp.replace(microsecond=0)


def is_link_media(row: Any) -> bool:
    """True when the media row was ingested from an external URL."""

    status_value = (getattr(row, "status", None) or "READY").upper()
    source_url = getattr(row, "source_url", None)
    url = getattr(row, "url", None)

    if status_value == "PENDING":
        return True

    if source_url:
        return True

    return isinstance(url, str) and url.startswith("pending://")


def append_if_new(
    rows: list[VideoUploadActivity],
    existing: set[tuple[int, str, str]],
    *,
    video: Video,
    event_type: VideoUploadActivityType,
    message: str,
    created_at: datetime,
    metadata: dict[str, object] | None = None,
) -> int:
    """Append one activity row when it is not already present.

    Returns 0 when written, 1 when skipped.
    """

    if not should_write(
        existing,
        video_id=video.id,
        event_type=event_type,
        message=message,
    ):
        return 1

    rows.append(
        activity_row(
            video=video,
            event_type=event_type,
            message=message,
            created_at=created_at,
            metadata=metadata,
        )
    )

    return 0
