"""Build synthetic activity rows for one upload video."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta

from app.models.video import Video, VideoImageUrl, VideoSampleImageUrl
from app.models.video_upload_activity import (
    VideoUploadActivity,
    VideoUploadActivityType,
)
from cli.video_upload_activity.helpers import (
    append_if_new,
    bucket_created_at,
    is_link_media,
)

_STATUS_READY = "READY"
_COMPLETED_STATUSES = frozenset(
    {
        "UPLOADED",
        "PROBING",
        "QUEUED",
        "ENCODING",
        "PACKAGING",
        "READY",
        "FAILED",
    }
)
_STREAM_STATUSES = frozenset(
    {
        "QUEUED",
        "ENCODING",
        "PACKAGING",
        "READY",
        "FAILED",
    }
)


def build_upload_stream_rows(
    *,
    video: Video,
    existing: set[tuple[int, str, str]],
    rendition_count: int,
) -> tuple[list[VideoUploadActivity], int]:
    """Build upload + stream lifecycle events for one video."""

    created = video.created_at or datetime.utcnow()
    updated = video.updated_at or created
    filename = video.original_filename or "source"
    status_value = (video.status or "").upper()
    rows: list[VideoUploadActivity] = []
    skipped = 0

    skipped += append_if_new(
        rows,
        existing,
        video=video,
        event_type=VideoUploadActivityType.UPLOAD_CREATED,
        message=f"Upload started for {filename}",
        created_at=created,
        metadata={
            "filename": filename,
            "size_bytes": video.source_bytes,
            "video_code": video.video_id,
            "backfill": True,
        },
    )

    if status_value in _COMPLETED_STATUSES and video.source_key:
        skipped += append_if_new(
            rows,
            existing,
            video=video,
            event_type=VideoUploadActivityType.UPLOAD_COMPLETED,
            message="Source upload completed",
            created_at=min(updated, created + timedelta(minutes=5)),
            metadata={
                "source_key": video.source_key,
                "backfill": True,
            },
        )

    if status_value in _STREAM_STATUSES or rendition_count > 0:
        skipped += append_if_new(
            rows,
            existing,
            video=video,
            event_type=VideoUploadActivityType.STREAM_ENCODING_STARTED,
            message="Stream encoding started",
            created_at=min(updated, created + timedelta(minutes=6)),
            metadata={
                "rendition_count": rendition_count,
                "backfill": True,
            },
        )

    if status_value == _STATUS_READY or video.ready_at is not None:
        skipped += append_if_new(
            rows,
            existing,
            video=video,
            event_type=VideoUploadActivityType.STREAM_READY,
            message="Stream ladder marked ready",
            created_at=video.ready_at or updated,
            metadata={
                "rendition_count": rendition_count,
                "backfill": True,
            },
        )

    return rows, skipped


def build_thumbnail_rows(
    *,
    video: Video,
    thumbs: list[VideoImageUrl],
    existing: set[tuple[int, str, str]],
    fallback_time: datetime,
) -> tuple[list[VideoUploadActivity], int]:
    """Group thumbnails by created second into batch activity rows."""

    rows: list[VideoUploadActivity] = []
    skipped = 0
    groups: dict[tuple[bool, datetime], list[VideoImageUrl]] = defaultdict(
        list
    )

    for thumb in thumbs:
        bucket = bucket_created_at(thumb.created_at, fallback_time)
        groups[(is_link_media(thumb), bucket)].append(thumb)

    for (is_link, bucket), batch in sorted(
        groups.items(), key=lambda item: item[0][1]
    ):
        types = sorted({(row.type or "unknown").lower() for row in batch})
        type_label = ", ".join(types)
        count = len(batch)

        if is_link:
            event_type = VideoUploadActivityType.THUMBNAIL_LINKED
            message = (
                f"Queued {count} thumbnail link"
                f"{'' if count == 1 else 's'} ({type_label})"
            )
        else:
            event_type = VideoUploadActivityType.THUMBNAIL_UPLOADED
            message = (
                f"Uploaded {count} thumbnail"
                f"{'' if count == 1 else 's'} ({type_label})"
            )

        skipped += append_if_new(
            rows,
            existing,
            video=video,
            event_type=event_type,
            message=message,
            created_at=bucket,
            metadata={
                "types": types,
                "count": count,
                "image_ids": [row.id for row in batch],
                "backfill": True,
            },
        )

    return rows, skipped


def build_sample_rows(
    *,
    video: Video,
    samples: list[VideoSampleImageUrl],
    existing: set[tuple[int, str, str]],
    fallback_time: datetime,
) -> tuple[list[VideoUploadActivity], int]:
    """Group samples by type and created second into batch activity rows."""

    rows: list[VideoUploadActivity] = []
    skipped = 0
    groups: dict[
        tuple[str, bool, datetime],
        list[VideoSampleImageUrl],
    ] = defaultdict(list)

    for sample in samples:
        image_type = (sample.type or "sample_s").lower()
        bucket = bucket_created_at(sample.created_at, fallback_time)
        groups[(image_type, is_link_media(sample), bucket)].append(sample)

    for (image_type, is_link, bucket), batch in sorted(
        groups.items(),
        key=lambda item: item[0][2],
    ):
        count = len(batch)

        if is_link:
            event_type = VideoUploadActivityType.SAMPLE_LINKED
            message = (
                f"Queued {count} sample link"
                f"{'' if count == 1 else 's'} ({image_type})"
            )
        else:
            event_type = VideoUploadActivityType.SAMPLE_UPLOADED
            message = (
                f"Uploaded {count} sample image"
                f"{'' if count == 1 else 's'} ({image_type})"
            )

        skipped += append_if_new(
            rows,
            existing,
            video=video,
            event_type=event_type,
            message=message,
            created_at=bucket,
            metadata={
                "type": image_type,
                "count": count,
                "sample_ids": [row.id for row in batch],
                "backfill": True,
            },
        )

    return rows, skipped
