"""Orchestrate activity log backfill for existing studio uploads."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

import typer
from sqlalchemy import func
from sqlmodel import col, select

from app.models.video import (
    Video,
    VideoImageUrl,
    VideoRendition,
    VideoSampleImageUrl,
)
from app.models.video_upload_activity import VideoUploadActivity
from cli.db import session_scope
from cli.video_upload_activity.build_rows import (
    build_sample_rows,
    build_thumbnail_rows,
    build_upload_stream_rows,
)
from cli.video_upload_activity.helpers import existing_event_keys

_ORIGIN_UPLOAD = "upload"
_BATCH_COMMIT = 100


async def _load_related(
    session: Any,
    video_ids: list[int],
) -> tuple[
    dict[int, list[VideoImageUrl]],
    dict[int, list[VideoSampleImageUrl]],
    dict[int, int],
]:
    """Load thumbnails, samples, and rendition counts keyed by video id."""

    thumbs_by_video: dict[int, list[VideoImageUrl]] = {
        vid: [] for vid in video_ids
    }
    samples_by_video: dict[int, list[VideoSampleImageUrl]] = {
        vid: [] for vid in video_ids
    }
    rendition_counts: dict[int, int] = {vid: 0 for vid in video_ids}

    thumb_rows = (
        (
            await session.execute(
                select(VideoImageUrl).where(
                    col(VideoImageUrl.fk_id).in_(video_ids)
                ),
            )
        )
        .scalars()
        .all()
    )

    for row in thumb_rows:
        thumbs_by_video.setdefault(row.fk_id, []).append(row)

    sample_rows = (
        (
            await session.execute(
                select(VideoSampleImageUrl).where(
                    col(VideoSampleImageUrl.fk_id).in_(video_ids),
                ),
            )
        )
        .scalars()
        .all()
    )

    for row in sample_rows:
        samples_by_video.setdefault(row.fk_id, []).append(row)

    rendition_rows = (
        await session.execute(
            select(
                col(VideoRendition.video_id),
                func.count(),
            )
            .where(col(VideoRendition.video_id).in_(video_ids))
            .group_by(col(VideoRendition.video_id)),
        )
    ).all()

    for row in rendition_rows:
        rendition_counts[int(row[0])] = int(row[1])

    return thumbs_by_video, samples_by_video, rendition_counts


def _rows_for_video(
    *,
    video: Video,
    existing: set[tuple[int, str, str]],
    thumbs: list[VideoImageUrl],
    samples: list[VideoSampleImageUrl],
    rendition_count: int,
) -> tuple[list[VideoUploadActivity], int]:
    """Collect all synthetic activity rows for one video."""

    updated = video.updated_at or video.created_at or datetime.utcnow()
    rows, skipped = build_upload_stream_rows(
        video=video,
        existing=existing,
        rendition_count=rendition_count,
    )

    thumb_rows, thumb_skipped = build_thumbnail_rows(
        video=video,
        thumbs=thumbs,
        existing=existing,
        fallback_time=updated,
    )
    sample_rows, sample_skipped = build_sample_rows(
        video=video,
        samples=samples,
        existing=existing,
        fallback_time=updated,
    )

    rows.extend(thumb_rows)
    rows.extend(sample_rows)
    skipped += thumb_skipped + sample_skipped

    return rows, skipped


def _build_query(
    *,
    video_id: int | None,
    public_id: uuid.UUID | None,
    limit: int | None,
) -> Any:
    """Build and filter the video query statement."""

    statement = (
        select(Video)
        .where(
            col(Video.origin) == _ORIGIN_UPLOAD,
            col(Video.public_id).is_not(None),
        )
        .order_by(col(Video.id).asc())
    )

    if video_id is not None:
        statement = statement.where(col(Video.id) == video_id)

    if public_id is not None:
        statement = statement.where(col(Video.public_id) == public_id)

    if limit is not None:
        statement = statement.limit(limit)

    return statement


async def _process_videos(
    *,
    session: Any,
    videos: list[Video],
    thumbs_by_video: dict[int, list[VideoImageUrl]],
    samples_by_video: dict[int, list[VideoSampleImageUrl]],
    rendition_counts: dict[int, int],
    existing: set[tuple[int, str, str]],
    dry_run: bool,
) -> tuple[int, int]:
    """Process all videos and return staged and skipped counts."""

    staged = 0
    skipped = 0
    pending_commit = 0

    for index, video in enumerate(videos, start=1):
        assert video.public_id is not None
        rows, video_skipped = _rows_for_video(
            video=video,
            existing=existing,
            thumbs=thumbs_by_video.get(video.id, []),
            samples=samples_by_video.get(video.id, []),
            rendition_count=rendition_counts.get(video.id, 0),
        )
        skipped += video_skipped
        staged += len(rows)

        if dry_run:
            typer.echo(
                f"[{index}/{len(videos)}] video_id={video.id} "
                f"public_id={video.public_id} would_write={len(rows)}",
            )

            continue

        for row in rows:
            session.add(row)
            existing.add((row.video_id, row.event_type, row.message))

        pending_commit += len(rows)

        if pending_commit >= _BATCH_COMMIT:
            await session.commit()
            pending_commit = 0
            typer.echo(
                f"[{index}/{len(videos)}] committed batch "
                f"(total staged={staged})",
            )

    if not dry_run and pending_commit > 0:
        await session.commit()

    return staged, skipped


async def run_backfill_activity(
    *,
    dry_run: bool,
    limit: int | None,
    video_id: int | None,
    public_id: uuid.UUID | None,
) -> None:
    """Synthesize upload / stream / media activity for existing uploads."""

    async with session_scope() as session:
        statement = _build_query(
            video_id=video_id,
            public_id=public_id,
            limit=limit,
        )

        videos = list((await session.execute(statement)).scalars().all())

        if not videos:
            typer.echo("No upload-origin videos matched.")

            return

        video_ids = [row.id for row in videos]
        existing = await existing_event_keys(session, video_ids)
        thumbs_by_video, samples_by_video, rendition_counts = (
            await _load_related(
                session,
                video_ids,
            )
        )

        staged, skipped = await _process_videos(
            session=session,
            videos=videos,
            thumbs_by_video=thumbs_by_video,
            samples_by_video=samples_by_video,
            rendition_counts=rendition_counts,
            existing=existing,
            dry_run=dry_run,
        )

        mode = "Dry-run" if dry_run else "Done"
        typer.echo(
            f"{mode}. videos={len(videos)} staged={staged} skipped={skipped}",
        )
