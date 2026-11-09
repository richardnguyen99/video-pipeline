"""User video upload service: create row, presign multipart, complete."""

# pylint: disable=broad-exception-caught,too-many-lines

from __future__ import annotations

import asyncio
import logging
import math
import re
import tempfile
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path, PurePosixPath
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import Date, Table, cast, delete, func, insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from sqlalchemy.sql.elements import ColumnElement
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession
from types_aiobotocore_s3.type_defs import CompletedPartTypeDef

from app.config import settings
from app.messaging.rabbitmq import publish_transcode_message
from app.messaging.transcode_job import maybe_recover_stuck_transcode
from app.messaging.transcode_progress import (
    clear_progress_snapshot,
    get_progress_snapshot,
)
from app.messaging.transcode_worker import process_transcode_message
from app.models.associations import (
    t_video_actress,
    t_video_director,
    t_video_genre,
    t_video_label,
    t_video_maker,
    t_video_series,
)
from app.models.comments import Comment
from app.models.video import (
    Video,
    VideoImageUrl,
    VideoM3u8,
    VideoRendition,
    VideoSampleImageUrl,
    VideoSampleMovieUrl,
)
from app.models.video_reaction import VideoReaction
from app.models.video_upload_activity import (
    VideoUploadActivity,
    VideoUploadActivityType,
)
from app.models.video_view import VideoView
from app.schemas.video_upload import (
    ExistingVideoSummary,
    PresignedPart,
    VideoCodeConflictDetail,
    VideoMediaResponse,
    VideoRenditionProgress,
    VideoUploadActivityItem,
    VideoUploadActivityListResponse,
    VideoUploadCompleteRequest,
    VideoUploadCreateRequest,
    VideoUploadCreateResponse,
    VideoUploadListItem,
    VideoUploadListResponse,
    VideoUploadMetadataUpdateRequest,
    VideoUploadMetricPoint,
    VideoUploadMetricSeries,
    VideoUploadObservabilityResponse,
    VideoUploadPartsResponse,
    VideoUploadStatusResponse,
)
from app.search.indexer import (
    remove_video_search_document,
    sync_video_search_document,
)
from app.services.video_upload_media import VideoUploadMediaMixin
from app.storage.client import ObjectStorageClient, purge_prefix
from app.utils.hls_encode import build_master_playlist
from app.utils.media_probe import probe_media
from app.utils.query import relationship_attr

_logger = logging.getLogger("uvicorn.error")

_SAFE_FILENAME = re.compile(r"[^A-Za-z0-9._-]+")
_STATUS_PENDING = "PENDING"
_STATUS_UPLOADED = "UPLOADED"
_STATUS_FAILED = "FAILED"
_STATUS_READY = "READY"
_ORIGIN_UPLOAD = "upload"
_VISIBILITY_PUBLIC = "public"
_VISIBILITY_UNLISTED = "unlisted"
_VISIBILITY_PRIVATE = "private"
_VISIBILITY_VALUES = frozenset(
    {
        _VISIBILITY_PUBLIC,
        _VISIBILITY_UNLISTED,
        _VISIBILITY_PRIVATE,
    },
)
_MAX_PRESIGN_BATCH = 100
# Overall progress when no ladder rows exist yet (probe / queue phase).
_PROGRESS_PRE_LADDER_PCT = 5.0
# Overall progress once encoding has started but rungs are still empty.
_PROGRESS_ENCODING_START_PCT = 8.0
# Share of the bar reserved for post-upload encode work (after start offset).
_PROGRESS_ENCODE_SPAN_PCT = 92.0
_PROGRESS_COMPLETE_PCT = 100.0
_PROGRESS_NONE_PCT = 0.0
# Video statuses that report zero overall progress.
_PROGRESS_IDLE_STATUSES = frozenset({"PENDING", "UPLOADING"})
# Video statuses that share the pre-ladder progress value.
_PROGRESS_PRE_LADDER_BY_STATUS: dict[str, float] = {
    "UPLOADED": _PROGRESS_PRE_LADDER_PCT,
    "PROBING": _PROGRESS_PRE_LADDER_PCT,
    "QUEUED": _PROGRESS_PRE_LADDER_PCT,
    "FAILED": _PROGRESS_NONE_PCT,
    "READY": _PROGRESS_COMPLETE_PCT,
}
# Raw multipart finished; wizard can resume past the binary upload step.
_RESUMABLE_STATUSES = frozenset(
    {
        "UPLOADED",
        "PROBING",
        "QUEUED",
        "ENCODING",
        "READY",
    }
)
_DEFAULT_LIST_LIMIT = 50
_MAX_LIST_LIMIT = 100


class VideoUploadService(VideoUploadMediaMixin):
    """Orchestrate Model B upload lifecycle against raw-uploads storage."""

    def __init__(
        self,
        session: AsyncSession,
        storage: ObjectStorageClient,
    ) -> None:
        """Bind session and storage client."""

        self._session = session
        self._storage = storage

    async def add_thumbnail_link(
        self,
        *,
        public_id: uuid.UUID,
        uploader_id: uuid.UUID,
        image_type: str,
        url: str,
    ) -> VideoMediaResponse:
        """Store an external thumbnail URL in the DB only (no object storage)."""

        return await VideoUploadMediaMixin.add_thumbnail_link(
            self,
            public_id=public_id,
            uploader_id=uploader_id,
            image_type=image_type,
            url=url,
        )

    async def add_sample_link(
        self,
        *,
        public_id: uuid.UUID,
        uploader_id: uuid.UUID,
        image_type: str,
        url: str,
    ) -> VideoMediaResponse:
        """Store an external sample image URL in the DB only (no object storage)."""

        return await VideoUploadMediaMixin.add_sample_link(
            self,
            public_id=public_id,
            uploader_id=uploader_id,
            image_type=image_type,
            url=url,
        )

    async def create_upload(
        self,
        *,
        uploader_id: uuid.UUID,
        payload: VideoUploadCreateRequest,
        uploader_role: str = "user",
    ) -> VideoUploadCreateResponse:
        """Create or admin-upsert a video row and return presigned part URLs."""

        title = payload.title or PurePosixPath(payload.filename).stem
        content_type = payload.content_type or "application/octet-stream"
        extension = self.__extension_for(payload.filename)
        existing: Video | None = None

        if payload.video_code:
            existing = await self.__find_by_video_id(payload.video_code)

            if existing is not None and not payload.allow_upsert:
                if uploader_role == "admin":
                    status_label = existing.status or "unknown"
                    conflict = VideoCodeConflictDetail(
                        message=(
                            f"Video code '{payload.video_code}' is already in use "
                            f"(id={existing.id}, status={status_label}). "
                            "Load existing catalog fields into the form, or confirm "
                            "replacing the source file."
                        ),
                        existing=self.__to_existing_summary(existing),
                    )
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=conflict.model_dump(mode="json"),
                    )

                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="This video code is already in use. Choose a different code.",
                )

            if existing is not None and payload.allow_upsert:
                if uploader_role != "admin":
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Only admins can update an existing video by video code.",
                    )

        public_id = (
            existing.public_id
            if existing is not None and existing.public_id is not None
            else uuid.uuid4()
        )
        source_key = f"{public_id}/source{extension}"
        video_code = (
            payload.video_code
            or (existing.video_id if existing is not None else None)
            or f"upl-{public_id.hex}"
        )

        multipart_upload_id = await self._storage.create_multipart_upload(
            object_key=source_key,
            content_type=content_type,
        )

        if existing is not None and payload.allow_upsert:
            video = existing
            video.title = title
            video.origin = _ORIGIN_UPLOAD
            video.public_id = public_id
            video.uploader_id = uploader_id
            video.original_filename = payload.filename
            video.source_key = source_key
            video.source_bytes = payload.size_bytes
            video.status = _STATUS_PENDING
            video.error_code = None
            video.error_message = None
            video.ready_at = None
            video.visibility = _VISIBILITY_UNLISTED
        else:
            video = Video(
                video_id=video_code,
                title=title,
                origin=_ORIGIN_UPLOAD,
                public_id=public_id,
                uploader_id=uploader_id,
                original_filename=payload.filename,
                source_key=source_key,
                source_bytes=payload.size_bytes,
                status=_STATUS_PENDING,
                visibility=_VISIBILITY_UNLISTED,
            )
            self._session.add(video)

        await self._session.flush()

        self.record_upload_activity(
            video=video,
            actor_id=uploader_id,
            event_type=VideoUploadActivityType.UPLOAD_CREATED,
            message=f"Upload started for {payload.filename}",
            metadata={
                "filename": payload.filename,
                "size_bytes": payload.size_bytes,
                "video_code": video_code,
            },
        )

        await self._session.commit()
        await self._session.refresh(video)

        part_count = max(
            1,
            math.ceil(payload.size_bytes / payload.part_size_bytes),
        )
        first_batch = min(part_count, _MAX_PRESIGN_BATCH)
        parts = await self.__presign_parts(
            source_key=source_key,
            multipart_upload_id=multipart_upload_id,
            part_numbers=list(range(1, first_batch + 1)),
        )

        assert video.public_id is not None
        assert video.status is not None

        return VideoUploadCreateResponse(
            id=video.id,
            public_id=video.public_id,
            status=video.status,
            source_key=source_key,
            multipart_upload_id=multipart_upload_id,
            part_size_bytes=payload.part_size_bytes,
            part_count=part_count,
            parts=parts,
        )

    async def presign_parts(
        self,
        *,
        public_id: uuid.UUID,
        uploader_id: uuid.UUID,
        multipart_upload_id: str,
        part_numbers: list[int],
    ) -> VideoUploadPartsResponse:
        """Return presigned URLs for the requested part numbers."""

        video = await self.__get_owned_upload(public_id, uploader_id)

        if video.status not in {_STATUS_PENDING, _STATUS_FAILED}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Upload is not accepting parts in its current status.",
            )

        if not video.source_key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Upload has no source key.",
            )

        cleaned = sorted({n for n in part_numbers if n >= 1})

        if not cleaned:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one valid part_number is required.",
            )

        if len(cleaned) > _MAX_PRESIGN_BATCH:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"At most {_MAX_PRESIGN_BATCH} parts per request.",
            )

        parts = await self.__presign_parts(
            source_key=video.source_key,
            multipart_upload_id=multipart_upload_id,
            part_numbers=cleaned,
        )

        return VideoUploadPartsResponse(parts=parts)

    async def complete_upload(
        self,
        *,
        public_id: uuid.UUID,
        uploader_id: uuid.UUID,
        payload: VideoUploadCompleteRequest,
    ) -> VideoUploadStatusResponse:
        """Complete multipart upload and mark the video as UPLOADED."""

        video = await self.__get_owned_upload(public_id, uploader_id)

        if video.status not in {_STATUS_PENDING, _STATUS_FAILED}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Upload cannot be completed in its current status.",
            )

        if not video.source_key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Upload has no source key.",
            )

        ordered = sorted(payload.parts, key=lambda p: p.part_number)
        s3_parts: list[CompletedPartTypeDef] = [
            {
                "ETag": self.__normalize_etag(part.etag),
                "PartNumber": part.part_number,
            }
            for part in ordered
        ]

        try:
            await self._storage.complete_multipart_upload(
                object_key=video.source_key,
                upload_id=payload.multipart_upload_id,
                parts=s3_parts,
            )
        except Exception as exc:
            video.status = _STATUS_FAILED
            video.error_code = "COMPLETE_FAILED"
            video.error_message = str(exc)[:2000]
            await self._session.commit()
            await self._session.refresh(video)

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to complete multipart upload.",
            ) from exc

        size = await self._storage.head_object_size(
            object_key=video.source_key,
        )

        if size is not None:
            video.source_bytes = size

        video.status = _STATUS_UPLOADED
        video.error_code = None
        video.error_message = None
        await self._session.commit()
        await self._session.refresh(video)

        # Fill width/height/fps/codecs immediately (does not depend on the worker).
        try:
            await self.__probe_source_metadata(video)
            await self._session.commit()
            await self._session.refresh(video)
        except Exception:
            _logger.exception(
                "source probe after complete failed public_id=%s",
                video.public_id,
            )

        if video.public_id is not None:
            job_payload: dict[str, object] = {
                "public_id": str(video.public_id),
                "video_id": video.id,
            }
            # Exactly one runner: RabbitMQ consumer when enabled, otherwise an
            # in-process task. Doing both starts two ffmpeg jobs for the same rung.
            if settings.rabbitmq_enabled:
                try:
                    await publish_transcode_message(job_payload)
                except Exception:
                    _logger.exception(
                        "publish transcode failed; falling back to in-process "
                        "public_id=%s",
                        video.public_id,
                    )
                    asyncio.create_task(
                        self.__run_transcode_safe(job_payload),
                        name=f"transcode-{video.public_id}",
                    )
            else:
                asyncio.create_task(
                    self.__run_transcode_safe(job_payload),
                    name=f"transcode-{video.public_id}",
                )

        self.record_upload_activity(
            video=video,
            actor_id=uploader_id,
            event_type=VideoUploadActivityType.UPLOAD_COMPLETED,
            message="Source upload completed",
            metadata={"source_key": video.source_key},
        )
        self.record_upload_activity(
            video=video,
            actor_id=uploader_id,
            event_type=VideoUploadActivityType.STREAM_ENCODING_STARTED,
            message="Stream encoding started",
        )
        await self._session.commit()
        await self._session.refresh(video)

        return self.__to_status(video)

    async def get_observability(
        self,
        *,
        public_id: uuid.UUID,
        uploader_id: uuid.UUID,
        days: int = 7,
        range_key: str | None = None,
    ) -> VideoUploadObservabilityResponse:
        """Return views, likes, and comments for an owned upload."""

        video = await self.__get_owned_upload(public_id, uploader_id)
        now = (
            datetime.now(timezone.utc)
            .replace(tzinfo=None)
            .replace(hour=0, minute=0, second=0, microsecond=0)
        )
        resolved_range, granularity, start, end, window_days = (
            self.__resolve_observability_window(
                range_key=range_key,
                days=days,
                now=now,
                uploaded_at=video.created_at,
            )
        )
        bucket_keys = self.__observability_bucket_keys(
            start=start,
            end=end,
            granularity=granularity,
        )

        views = await self.__bucketed_metric_series(
            col(VideoView.created_at),
            col(VideoView.video_id) == video.id,
            start=start,
            end=end,
            granularity=granularity,
            bucket_keys=bucket_keys,
        )
        likes = await self.__bucketed_metric_series(
            col(VideoReaction.created_at),
            col(VideoReaction.video_id) == video.id,
            col(VideoReaction.is_like).is_(True),
            start=start,
            end=end,
            granularity=granularity,
            bucket_keys=bucket_keys,
        )
        comments = await self.__bucketed_metric_series(
            col(Comment.created_at),
            col(Comment.video_id) == video.id,
            col(Comment.is_deleted).is_(False),
            start=start,
            end=end,
            granularity=granularity,
            bucket_keys=bucket_keys,
        )

        return VideoUploadObservabilityResponse(
            public_id=public_id,
            video_id=int(video.id),
            days=window_days,
            range=resolved_range,
            granularity=granularity,
            views=views,
            likes=likes,
            comments=comments,
        )

    @staticmethod
    def __resolve_observability_window(
        *,
        range_key: str | None,
        days: int,
        now: datetime,
        uploaded_at: datetime | None,
    ) -> tuple[str, str, datetime, datetime, int]:
        """Map range/days into start, end, granularity, and window length."""

        end = now + timedelta(days=1)
        normalized = (range_key or "").strip().lower()

        if normalized in {"week", "1week", "7d"}:
            start = now - timedelta(days=6)
            return "week", "day", start, end, 7

        if normalized in {"3months", "3month", "90d"}:
            start = now - timedelta(days=89)
            return "3months", "week", start, end, 90

        if normalized in {"year", "1year", "365d"}:
            start = now - timedelta(days=364)
            return "year", "month", start, end, 365

        if normalized in {"all", "alltime", "all_time"}:
            origin = uploaded_at or now

            if origin.tzinfo is not None:
                origin = origin.astimezone(timezone.utc).replace(tzinfo=None)

            start = min(
                origin.replace(
                    hour=0,
                    minute=0,
                    second=0,
                    microsecond=0,
                ),
                now,
            )

            span_days = max(1, (now.date() - start.date()).days + 1)

            if span_days <= 14:
                granularity = "day"
            elif span_days <= 120:
                granularity = "week"
            else:
                granularity = "month"

            return "all", granularity, start, end, span_days

        window_days = max(1, min(days, 90))
        start = now - timedelta(days=window_days - 1)
        return "week", "day", start, end, window_days

    @staticmethod
    def __observability_bucket_keys(
        *,
        start: datetime,
        end: datetime,
        granularity: str,
    ) -> list[str]:
        """Generate ordered bucket keys covering ``[start, end)``."""

        keys: list[str] = []
        cursor = start.date()
        end_date = end.date()

        if granularity == "month":
            cursor = cursor.replace(day=1)
            while cursor < end_date:
                keys.append(cursor.isoformat())
                if cursor.month == 12:
                    cursor = cursor.replace(year=cursor.year + 1, month=1)
                else:
                    cursor = cursor.replace(month=cursor.month + 1)
            return keys

        if granularity == "week":
            cursor = cursor - timedelta(days=cursor.weekday())
            while cursor < end_date:
                keys.append(cursor.isoformat())
                cursor = cursor + timedelta(days=7)
            return keys

        while cursor < end_date:
            keys.append(cursor.isoformat())
            cursor = cursor + timedelta(days=1)

        return keys

    @staticmethod
    def __bucket_key_from_value(value: Any, granularity: str) -> str:
        day: date

        if isinstance(value, datetime):
            normalized = value

            if normalized.tzinfo is not None:
                normalized = normalized.astimezone(timezone.utc).replace(
                    tzinfo=None,
                )

            day = normalized.date()
        elif isinstance(value, date):
            day = value
        else:
            raw = str(value)[:10]
            day = datetime.strptime(raw, "%Y-%m-%d").date()

        if granularity == "month":
            key = day.replace(day=1).isoformat()
        elif granularity == "week":
            key = (day - timedelta(days=day.weekday())).isoformat()
        else:
            key = day.isoformat()

        return str(key)

    async def __bucketed_metric_series(
        self,
        timestamp_column: Any,
        *filters: Any,
        start: datetime,
        end: datetime,
        granularity: str,
        bucket_keys: list[str],
    ) -> VideoUploadMetricSeries:
        """Count rows per day/week/month bucket for the selected window."""

        bucket_expr: ColumnElement[Any]

        if granularity == "month":
            bucket_expr = func.date_trunc("month", timestamp_column)
        elif granularity == "week":
            bucket_expr = func.date_trunc("week", timestamp_column)
        else:
            bucket_expr = cast(timestamp_column, Date)

        statement = (
            select(bucket_expr.label("bucket"), func.count().label("count"))
            .where(
                *filters,
                timestamp_column >= start,
                timestamp_column < end,
            )
            .group_by(bucket_expr)
            .order_by(bucket_expr)
        )
        rows = (await self._session.exec(statement)).all()
        by_bucket: dict[str, int] = {}

        for row in rows:
            key = self.__bucket_key_from_value(row[0], granularity)
            by_bucket[key] = by_bucket.get(key, 0) + int(row[1])

        points: list[VideoUploadMetricPoint] = []
        total = 0

        for key in bucket_keys:
            count_value = int(by_bucket.get(key, 0))
            total += count_value
            points.append(VideoUploadMetricPoint(date=key, count=count_value))

        return VideoUploadMetricSeries(total=total, points=points)

    async def get_status(
        self,
        *,
        public_id: uuid.UUID,
        uploader_id: uuid.UUID,
    ) -> VideoUploadStatusResponse:
        """Return status for an upload owned by the current user.

        Live progress is preferred from Redis; Postgres is the durable
        source when the job is not running or Redis is empty.
        """

        video = await self.__get_owned_upload(public_id, uploader_id)
        relation_ids = await self.__load_relation_ids(video.id)
        renditions = await self.__list_renditions(video.id)
        has_incomplete = any(
            (row.status or "").upper() != "READY" or not row.playlist_key
            for row in renditions
        )

        if (video.status or "").upper() != "READY" or has_incomplete:
            try:
                should_requeue = await maybe_recover_stuck_transcode(
                    public_id=public_id,
                    status=video.status or "",
                    has_incomplete_rungs=has_incomplete or not renditions,
                )

                if should_requeue:
                    await publish_transcode_message(
                        {"public_id": str(public_id)},
                    )
            except Exception:
                _logger.debug(
                    "transcode recovery trigger failed public_id=%s",
                    public_id,
                    exc_info=True,
                )

        live = await get_progress_snapshot(public_id)

        if live is not None and live.rungs:
            progress_rows = [
                VideoRenditionProgress(
                    label=rung.label,
                    width=rung.width,
                    height=rung.height,
                    video_kbps=rung.video_kbps,
                    status=rung.status,
                    progress_pct=rung.progress_pct,
                    attempt=0,
                    segment_count=rung.segment_count,
                    playlist_key=rung.playlist_key,
                )
                for rung in live.rungs
            ]
            raw_status = live.status or video.status or _STATUS_PENDING
            status_value = VideoUploadService.__derive_list_status(
                status=raw_status,
                progress_rows=progress_rows,
            )
            computed_overall = VideoUploadService.__overall_progress(
                status=status_value,
                renditions=progress_rows,
            )
            overall = max(float(live.overall_pct), computed_overall)

            if status_value.upper() == _STATUS_READY:
                overall = _PROGRESS_COMPLETE_PCT
                await self.__heal_ready_if_complete(
                    video=video,
                    progress_rows=progress_rows,
                )
                await self.__reconcile_master_playlist(
                    video=video,
                    progress_rows=progress_rows,
                )

            return self.__to_status(
                video,
                renditions=None,
                progress_rows=progress_rows,
                status_override=status_value,
                overall_override=overall,
                relation_ids=relation_ids,
            )

        progress_rows = [
            VideoRenditionProgress(
                label=row.label,
                width=row.width,
                height=row.height,
                video_kbps=row.video_kbps,
                status=row.status,
                progress_pct=row.progress_pct,
                attempt=row.attempt,
                segment_count=row.segment_count,
                playlist_key=row.playlist_key,
            )
            for row in renditions
        ]
        status_value = VideoUploadService.__derive_list_status(
            status=video.status or _STATUS_PENDING,
            progress_rows=progress_rows,
        )

        if status_value.upper() == _STATUS_READY:
            await self.__heal_ready_if_complete(
                video=video,
                progress_rows=progress_rows,
            )
            await self.__reconcile_master_playlist(
                video=video,
                progress_rows=progress_rows,
            )

        return self.__to_status(
            video,
            renditions=None,
            progress_rows=progress_rows,
            status_override=status_value,
            relation_ids=relation_ids,
        )

    async def update_metadata(
        self,
        *,
        public_id: uuid.UUID,
        uploader_id: uuid.UUID,
        payload: VideoUploadMetadataUpdateRequest,
    ) -> VideoUploadStatusResponse:
        """Update scalar catalog fields and replace relation association sets."""

        video = await self.__get_owned_upload(public_id, uploader_id)
        await self.__apply_metadata_scalars(video, payload)
        await self.__apply_metadata_relations(video.id, payload)

        self.record_upload_activity(
            video=video,
            actor_id=uploader_id,
            event_type=VideoUploadActivityType.METADATA_UPDATED,
            message="Catalog metadata updated",
            metadata={
                "title": video.title,
                "video_id": video.video_id,
                "visibility": video.visibility,
            },
        )

        try:
            await self._session.commit()
        except IntegrityError as exc:
            await self._session.rollback()

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more catalog relation ids are invalid.",
            ) from exc

        await self._session.refresh(video)
        await sync_video_search_document(self._session, video.id)

        relation_ids = await self.__load_relation_ids(video.id)
        renditions = await self.__list_renditions(video.id)

        return self.__to_status(
            video,
            renditions=renditions,
            relation_ids=relation_ids,
        )

    async def __apply_metadata_scalars(
        self,
        video: Video,
        payload: VideoUploadMetadataUpdateRequest,
    ) -> None:
        """Apply optional scalar catalog fields from a metadata patch."""

        if payload.title is not None:
            trimmed = payload.title.strip()
            video.title = trimmed or video.title

        if payload.video_id is not None:
            await self.__apply_video_code(video, payload.video_id)

        if payload.cid is not None:
            video.cid = payload.cid.strip() or None

        if payload.jancode is not None:
            video.jancode = payload.jancode.strip() or None

        if payload.maker_product is not None:
            video.maker_product = payload.maker_product.strip() or None

        if payload.release_date is not None:
            video.release_date = payload.release_date

        if payload.visibility is not None:
            await self.__apply_visibility(video, payload.visibility)

    async def __apply_video_code(self, video: Video, raw_code: str) -> None:
        """Validate and assign a new business video code when it changes."""

        next_code = raw_code.strip()

        if not next_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="video_id cannot be empty.",
            )

        if next_code == video.video_id:
            return

        conflict = await self.__find_by_video_id(next_code)

        if conflict is not None and conflict.id != video.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Video code '{next_code}' is already in use "
                    "by another catalog entry."
                ),
            )

        video.video_id = next_code

    async def __apply_visibility(
        self, video: Video, raw_visibility: str
    ) -> None:
        """Validate and assign upload visibility.

        Engagement metrics and other users' history rows are never deleted.
        Search indexing is reconciled on commit via ``sync_video_search_document``.
        """

        next_visibility = raw_visibility.strip().lower()

        if next_visibility not in _VISIBILITY_VALUES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="visibility must be public, unlisted, or private.",
            )

        video.visibility = next_visibility

    async def __apply_metadata_relations(
        self,
        video_id: int,
        payload: VideoUploadMetadataUpdateRequest,
    ) -> None:
        """Replace association sets present on the metadata payload."""

        relation_specs: list[tuple[Table, list[int] | None]] = [
            (t_video_actress, payload.actress_ids),
            (t_video_maker, payload.maker_ids),
            (t_video_genre, payload.genre_ids),
            (t_video_series, payload.series_ids),
            (t_video_label, payload.label_ids),
            (t_video_director, payload.director_ids),
        ]

        for table, ids in relation_specs:
            if ids is None:
                continue

            await self.__replace_association_ids(
                table=table,
                video_id=video_id,
                fk_ids=ids,
            )

    async def recover_rendition(
        self,
        *,
        public_id: uuid.UUID,
        uploader_id: uuid.UUID,
        label: str,
    ) -> VideoUploadStatusResponse:
        """Purge a failed/stuck rung's segments, reset the row, and re-queue encode."""

        normalized = label.strip().lower()

        if not normalized:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Rendition label is required.",
            )

        video = await self.__get_owned_upload(public_id, uploader_id)
        renditions = await self.__list_renditions(video.id)
        target = next(
            (row for row in renditions if row.label.lower() == normalized),
            None,
        )

        if target is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Rendition '{normalized}' not found.",
            )

        target_status = (target.status or "").upper()

        if target_status == "READY":
            _logger.info(
                "recover READY rung public_id=%s label=%s playlist_key=%s",
                public_id,
                target.label,
                target.playlist_key,
            )

        prefix = f"{public_id}/{target.label}"
        deleted = await purge_prefix(
            self._storage,
            prefix=prefix,
            bucket=self._storage.streams_bucket,
        )
        _logger.info(
            "recover rendition purged public_id=%s label=%s objects=%s",
            public_id,
            target.label,
            deleted,
        )

        target.status = "PENDING"
        target.progress_pct = 0
        target.segment_count = 0
        target.playlist_key = None
        target.attempt = 0

        if (video.status or "").upper() in {
            "READY",
            "FAILED",
            "ENCODING",
            "PACKAGING",
        }:
            video.status = "ENCODING"
            video.error_code = None
            video.error_message = None

        self.record_upload_activity(
            video=video,
            actor_id=uploader_id,
            event_type=VideoUploadActivityType.RENDITION_RECOVERED,
            message=f"Recovered {target.label} resolution",
            metadata={"label": target.label},
        )

        await self._session.commit()
        await self._session.refresh(video)

        try:
            await publish_transcode_message({"public_id": str(public_id)})
        except Exception:
            _logger.exception(
                "recover rendition requeue failed public_id=%s label=%s",
                public_id,
                target.label,
            )
            asyncio.create_task(
                self.__run_transcode_safe({"public_id": str(public_id)}),
                name=f"recover-transcode-{public_id}",
            )

        relation_ids = await self.__load_relation_ids(video.id)
        refreshed = await self.__list_renditions(video.id)

        return self.__to_status(
            video,
            renditions=refreshed,
            relation_ids=relation_ids,
        )

    async def rebuild_stream(
        self,
        *,
        public_id: uuid.UUID,
        uploader_id: uuid.UUID,
    ) -> VideoUploadStatusResponse:
        """Purge all stream objects, reset every rendition, and re-queue encode."""

        video = await self.__get_owned_upload(public_id, uploader_id)
        renditions = await self.__list_renditions(video.id)

        deleted = await purge_prefix(
            self._storage,
            prefix=f"{public_id}/",
            bucket=self._storage.streams_bucket,
            exclude_media=True,
        )
        _logger.info(
            "rebuild stream purged public_id=%s objects=%s",
            public_id,
            deleted,
        )

        for row in renditions:
            row.status = "PENDING"
            row.progress_pct = 0
            row.segment_count = 0
            row.playlist_key = None
            row.attempt = 0

        video.status = "ENCODING"
        video.error_code = None
        video.error_message = None
        video.ready_at = None

        self.record_upload_activity(
            video=video,
            actor_id=uploader_id,
            event_type=VideoUploadActivityType.STREAM_REBUILT,
            message="Full stream rebuild started",
            metadata={
                "rendition_count": len(renditions),
                "labels": [row.label for row in renditions],
            },
        )

        await self._session.commit()
        await self._session.refresh(video)

        await clear_progress_snapshot(public_id)

        try:
            await publish_transcode_message({"public_id": str(public_id)})
        except Exception:
            _logger.exception(
                "rebuild stream requeue failed public_id=%s",
                public_id,
            )
            asyncio.create_task(
                self.__run_transcode_safe({"public_id": str(public_id)}),
                name=f"rebuild-transcode-{public_id}",
            )

        relation_ids = await self.__load_relation_ids(video.id)
        refreshed = await self.__list_renditions(video.id)

        return self.__to_status(
            video,
            renditions=refreshed,
            relation_ids=relation_ids,
        )

    async def delete_upload(
        self,
        *,
        public_id: uuid.UUID,
        uploader_id: uuid.UUID,
    ) -> None:
        """Remove an owned upload, its stream objects, and related media rows."""

        video = await self.__get_owned_upload(public_id, uploader_id)
        video_id = video.id

        await purge_prefix(
            self._storage,
            prefix=f"{public_id}/",
            bucket=self._storage.streams_bucket,
        )

        if video.source_key:
            try:
                await self._storage.delete_object(
                    object_key=video.source_key,
                    bucket=self._storage.raw_uploads_bucket,
                )
            except Exception:
                _logger.exception(
                    "delete upload source failed public_id=%s key=%s",
                    public_id,
                    video.source_key,
                )

        for table in (
            t_video_actress,
            t_video_maker,
            t_video_genre,
            t_video_series,
            t_video_label,
            t_video_director,
        ):
            await self._session.execute(
                delete(table).where(table.c.video_id == video_id)
            )

        await self._session.execute(
            delete(VideoRendition).where(
                col(VideoRendition.video_id) == video_id
            ),
        )
        await self._session.execute(
            delete(VideoImageUrl).where(col(VideoImageUrl.fk_id) == video_id),
        )
        await self._session.execute(
            delete(VideoSampleImageUrl).where(
                col(VideoSampleImageUrl.fk_id) == video_id
            ),
        )
        await self._session.execute(
            delete(VideoSampleMovieUrl).where(
                col(VideoSampleMovieUrl.fk_id) == video_id
            ),
        )
        await self._session.execute(
            delete(VideoM3u8).where(col(VideoM3u8.fk_id) == video_id),
        )
        await self._session.execute(
            delete(VideoUploadActivity).where(
                col(VideoUploadActivity.video_id) == video_id,
            ),
        )
        await self._session.delete(video)
        await self._session.commit()
        await remove_video_search_document(video_id)

        _logger.info(
            "deleted upload public_id=%s video_id=%s", public_id, video_id
        )

    async def list_uploads(
        self,
        *,
        uploader_id: uuid.UUID,
        limit: int = _DEFAULT_LIST_LIMIT,
        offset: int = 0,
    ) -> VideoUploadListResponse:
        """Return recent uploads owned by the user, newest first."""

        safe_limit = max(1, min(limit, _MAX_LIST_LIMIT))
        safe_offset = max(0, offset)

        count_statement = (
            select(func.count())
            .select_from(Video)
            .where(col(Video.uploader_id) == uploader_id)
            .where(col(Video.origin) == _ORIGIN_UPLOAD)
        )
        count_result = await self._session.execute(count_statement)
        total = int(count_result.scalar_one())

        statement = (
            select(Video)
            .where(col(Video.uploader_id) == uploader_id)
            .where(col(Video.origin) == _ORIGIN_UPLOAD)
            .order_by(col(Video.updated_at).desc())
            .offset(safe_offset)
            .limit(safe_limit)
        )
        result = await self._session.execute(statement)
        rows = list(result.scalars().all())
        renditions_by_video = await self.__list_renditions_for_videos(
            [row.id for row in rows],
        )
        items = [
            await self.__to_list_item_async(
                row,
                renditions=renditions_by_video.get(row.id, []),
            )
            for row in rows
        ]

        return VideoUploadListResponse(items=items, total=total)

    async def assert_owned_upload(
        self,
        *,
        public_id: uuid.UUID,
        uploader_id: uuid.UUID,
    ) -> Video:
        """Return the owned video row or raise 404 (SSE / status auth)."""

        return await self.__get_owned_upload(public_id, uploader_id)

    async def __find_by_video_id(self, video_id: str) -> Video | None:
        """Return the video row for a business video_id, if any."""

        statement = (
            select(Video)
            .where(Video.video_id == video_id)
            .options(
                selectinload(relationship_attr(Video.actresses)),
                selectinload(relationship_attr(Video.makers)),
                selectinload(relationship_attr(Video.genres)),
                selectinload(relationship_attr(Video.series)),
                selectinload(relationship_attr(Video.labels)),
                selectinload(relationship_attr(Video.directors)),
            )
        )
        result = await self._session.execute(statement)

        return result.scalar_one_or_none()

    def __to_existing_summary(self, video: Video) -> ExistingVideoSummary:
        """Map an ORM video (with relations loaded) to a conflict summary."""

        def relation_ids(attr: str) -> list[int]:
            items = getattr(video, attr, None) or []

            return [
                item.id
                for item in items
                if getattr(item, "id", None) is not None
            ]

        return ExistingVideoSummary(
            id=video.id,
            video_id=video.video_id,
            title=video.title,
            cid=video.cid,
            jancode=video.jancode,
            maker_product=video.maker_product,
            release_date=video.release_date,
            status=video.status,
            public_id=video.public_id,
            actress_ids=relation_ids("actresses"),
            maker_ids=relation_ids("makers"),
            genre_ids=relation_ids("genres"),
            series_ids=relation_ids("series"),
            label_ids=relation_ids("labels"),
            director_ids=relation_ids("directors"),
        )

    async def __get_owned_upload(
        self,
        public_id: uuid.UUID,
        uploader_id: uuid.UUID,
    ) -> Video:
        """Load a user-owned upload video or raise 404."""

        statement = select(Video).where(
            Video.public_id == public_id,
            Video.uploader_id == uploader_id,
            Video.origin == _ORIGIN_UPLOAD,
        )
        result = await self._session.exec(statement)
        video = result.one_or_none()

        if video is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Upload not found.",
            )

        return video

    async def __presign_parts(
        self,
        *,
        source_key: str,
        multipart_upload_id: str,
        part_numbers: list[int],
    ) -> list[PresignedPart]:
        """Presign upload_part URLs for the given part numbers."""

        parts: list[PresignedPart] = []

        for number in part_numbers:
            url = await self._storage.generate_presigned_upload_part_url(
                object_key=source_key,
                upload_id=multipart_upload_id,
                part_number=number,
            )
            parts.append(PresignedPart(part_number=number, url=url))

        return parts

    @staticmethod
    def __extension_for(filename: str) -> str:
        """Return a sanitized file extension including the leading dot."""

        suffix = PurePosixPath(filename).suffix.lower()

        if not suffix or len(suffix) > 16:
            return ".bin"

        cleaned = _SAFE_FILENAME.sub("", suffix)

        if not cleaned.startswith("."):
            return ".bin"

        return cleaned

    @staticmethod
    def __normalize_etag(etag: str) -> str:
        """Ensure ETag is quoted as required by S3 CompleteMultipartUpload."""

        value = etag.strip()

        if value.startswith('"') and value.endswith('"'):
            return value

        return f'"{value}"'

    async def __probe_source_metadata(self, video: Video) -> None:
        """Run ffprobe on the uploaded source and fill media columns."""

        if not video.source_key:
            return

        source_url = await self._storage.generate_presigned_get_url(
            object_key=video.source_key,
        )
        probe = await probe_media(source_url)

        if not probe.has_video:
            _logger.warning(
                "probe found no video stream public_id=%s",
                video.public_id,
            )

            return

        if video.duration is None and probe.duration_s is not None:
            video.duration = probe.duration_s

        if probe.width is not None:
            video.width = probe.width

        if probe.height is not None:
            video.height = probe.height

        if probe.fps is not None:
            video.fps = probe.fps

        if probe.video_codec:
            video.video_codec = probe.video_codec[:50]

        if probe.audio_codec:
            video.audio_codec = probe.audio_codec[:50]

        _logger.info(
            "probed source public_id=%s %sx%s codec=%s/%s",
            video.public_id,
            video.width,
            video.height,
            video.video_codec,
            video.audio_codec,
        )

    @staticmethod
    async def __run_transcode_safe(payload: dict[str, object]) -> None:
        """Background encode; errors are logged, never raised to the request."""

        try:
            await process_transcode_message(payload)
        except Exception:
            _logger.exception(
                "background transcode failed payload=%s",
                payload,
            )

    async def __list_renditions(self, video_id: int) -> list[VideoRendition]:
        """Load ladder rows ordered by height ascending."""

        result = await self._session.execute(
            select(VideoRendition)
            .where(VideoRendition.video_id == video_id)
            .order_by(col(VideoRendition.height).asc()),
        )

        return list(result.scalars().all())

    async def __list_renditions_for_videos(
        self,
        video_ids: list[int],
    ) -> dict[int, list[VideoRendition]]:
        """Batch-load ladder rows for many videos, keyed by video id."""

        if not video_ids:
            return {}

        result = await self._session.execute(
            select(VideoRendition)
            .where(col(VideoRendition.video_id).in_(video_ids))
            .order_by(col(VideoRendition.height).asc()),
        )
        grouped: dict[int, list[VideoRendition]] = {}

        for row in result.scalars().all():
            grouped.setdefault(row.video_id, []).append(row)

        return grouped

    @staticmethod
    def __progress_rows_from_renditions(
        renditions: list[VideoRendition],
    ) -> list[VideoRenditionProgress]:
        """Map ORM ladder rows to progress DTOs."""

        return [
            VideoRenditionProgress(
                label=row.label,
                width=row.width,
                height=row.height,
                video_kbps=row.video_kbps,
                status=row.status,
                progress_pct=row.progress_pct,
                attempt=row.attempt,
                segment_count=row.segment_count,
                playlist_key=row.playlist_key,
            )
            for row in renditions
        ]

    async def __to_list_item_async(
        self,
        video: Video,
        *,
        renditions: list[VideoRendition],
    ) -> VideoUploadListItem:
        """Build a list item using durable ladder rows and optional Redis live state."""

        progress_rows = self.__progress_rows_from_renditions(renditions)
        status_value = video.status or _STATUS_PENDING
        overall_override: float | None = None

        if video.public_id is not None and status_value.upper() not in {
            _STATUS_READY,
            _STATUS_FAILED,
            _STATUS_PENDING,
        }:
            live = await get_progress_snapshot(video.public_id)

            if live is not None and live.rungs:
                progress_rows = [
                    VideoRenditionProgress(
                        label=rung.label,
                        width=rung.width,
                        height=rung.height,
                        video_kbps=rung.video_kbps,
                        status=rung.status,
                        progress_pct=rung.progress_pct,
                        attempt=0,
                        segment_count=rung.segment_count,
                        playlist_key=rung.playlist_key,
                    )
                    for rung in live.rungs
                ]
                status_value = live.status or status_value
                overall_override = live.overall_pct

        return self.__to_list_item(
            video,
            progress_rows=progress_rows,
            status_override=status_value,
            overall_override=overall_override,
        )

    @staticmethod
    def __to_status(
        video: Video,
        *,
        renditions: list[VideoRendition] | None = None,
        progress_rows: list[VideoRenditionProgress] | None = None,
        status_override: str | None = None,
        overall_override: float | None = None,
        relation_ids: dict[str, list[int]] | None = None,
    ) -> VideoUploadStatusResponse:
        """Map a Video row to the status response schema."""

        assert video.public_id is not None

        if progress_rows is None:
            rows = renditions or []
            progress_rows = [
                VideoRenditionProgress(
                    label=row.label,
                    width=row.width,
                    height=row.height,
                    video_kbps=row.video_kbps,
                    status=row.status,
                    progress_pct=row.progress_pct,
                    attempt=row.attempt,
                    segment_count=row.segment_count,
                    playlist_key=row.playlist_key,
                )
                for row in rows
            ]

        status_value = status_override or video.status or _STATUS_PENDING
        overall = (
            overall_override
            if overall_override is not None
            else VideoUploadService.__overall_progress(
                status=status_value,
                renditions=progress_rows,
            )
        )
        links = relation_ids or {}

        return VideoUploadStatusResponse(
            id=video.id,
            public_id=video.public_id,
            status=status_value,
            video_id=video.video_id,
            original_filename=video.original_filename,
            source_key=video.source_key,
            source_bytes=video.source_bytes,
            title=video.title,
            cid=video.cid,
            jancode=video.jancode,
            maker_product=video.maker_product,
            release_date=video.release_date,
            visibility=video.visibility or _VISIBILITY_UNLISTED,
            error_code=video.error_code,
            error_message=video.error_message,
            ready_at=video.ready_at,
            created_at=video.created_at,
            updated_at=video.updated_at,
            overall_progress_pct=overall,
            renditions=progress_rows,
            actress_ids=links.get("actresses", []),
            maker_ids=links.get("makers", []),
            genre_ids=links.get("genres", []),
            series_ids=links.get("series", []),
            label_ids=links.get("labels", []),
            director_ids=links.get("directors", []),
        )

    async def __load_relation_ids(self, video_id: int) -> dict[str, list[int]]:
        """Load association fk_id lists for each catalog relation type."""

        specs: list[tuple[str, Table]] = [
            ("actresses", t_video_actress),
            ("makers", t_video_maker),
            ("genres", t_video_genre),
            ("series", t_video_series),
            ("labels", t_video_label),
            ("directors", t_video_director),
        ]
        result: dict[str, list[int]] = {}

        for key, table in specs:
            statement = (
                select(table.c.fk_id)
                .where(table.c.video_id == video_id)
                .order_by(table.c.fk_id)
            )
            rows = await self._session.execute(statement)
            result[key] = [int(row[0]) for row in rows.all()]

        return result

    async def __replace_association_ids(
        self,
        *,
        table: Table,
        video_id: int,
        fk_ids: list[int],
    ) -> None:
        """Replace all association rows for one relation type on a video."""

        unique_ids = sorted({int(fk_id) for fk_id in fk_ids if int(fk_id) > 0})

        await self._session.execute(
            delete(table).where(table.c.video_id == video_id),
        )

        if not unique_ids:
            return

        await self._session.execute(
            insert(table),
            [{"video_id": video_id, "fk_id": fk_id} for fk_id in unique_ids],
        )

    async def __heal_ready_if_complete(
        self,
        *,
        video: Video,
        progress_rows: list[VideoRenditionProgress],
    ) -> None:
        """Persist READY when every rung finished but the video row lagged."""

        if not progress_rows:
            return

        if any(
            row.status.upper() != _STATUS_READY or not row.playlist_key
            for row in progress_rows
        ):
            return

        if (
            video.status or ""
        ).upper() == _STATUS_READY and video.ready_at is not None:
            return

        video.status = _STATUS_READY
        video.error_code = None
        video.error_message = None

        if video.ready_at is None:
            video.ready_at = datetime.now(timezone.utc).replace(tzinfo=None)

        self.record_upload_activity(
            video=video,
            actor_id=video.uploader_id,
            event_type=VideoUploadActivityType.STREAM_READY,
            message="Stream ladder marked ready",
            metadata={
                "rendition_count": len(progress_rows),
            },
        )

        await self._session.commit()
        await self._session.refresh(video)
        await sync_video_search_document(self._session, video.id)

    async def __reconcile_master_playlist(
        self,
        *,
        video: Video,
        progress_rows: list[VideoRenditionProgress],
    ) -> None:
        """Rewrite master index.m3u8 from READY rungs that exist in storage.

        Covers interruptions after a rung uploaded but before the master was
        republished so the player always lists every playable resolution.
        """

        if video.public_id is None or not progress_rows:
            return

        public_id = video.public_id
        ready_specs: list[tuple[str, int, int, int]] = []

        for row in progress_rows:
            if (row.status or "").upper() != _STATUS_READY:
                continue

            if not row.playlist_key:
                continue

            playlist_key = f"{public_id}/{row.label}/playlist.m3u8"
            exists = await self._storage.object_exists(
                playlist_key,
                bucket=self._storage.streams_bucket,
            )

            if not exists:
                _logger.warning(
                    "master reconcile: missing playlist public_id=%s key=%s",
                    public_id,
                    playlist_key,
                )

                continue

            ready_specs.append(
                (row.label, row.width, row.height, row.video_kbps),
            )

        if not ready_specs:
            return

        body = build_master_playlist(ready_specs)
        object_key = f"{public_id}/index.m3u8"

        with tempfile.TemporaryDirectory(prefix="hls-master-") as tmp:
            master_path = Path(tmp) / "index.m3u8"
            master_path.write_text(body, encoding="utf-8")
            master_url = await self._storage.upload_file(
                object_key=object_key,
                file_path=master_path,
                content_type="application/vnd.apple.mpegurl",
                bucket=self._storage.streams_bucket,
            )

        result = await self._session.exec(
            select(VideoM3u8).where(
                VideoM3u8.fk_id == video.id,
                VideoM3u8.m3u8_url == master_url,
            ),
        )
        existing = result.first()

        if existing is None:
            self._session.add(
                VideoM3u8(
                    fk_id=video.id,
                    m3u8_url=master_url,
                ),
            )
            await self._session.commit()

        _logger.info(
            "master reconciled public_id=%s rungs=%s",
            public_id,
            [spec[0] for spec in ready_specs],
        )

    async def list_activity(
        self,
        *,
        public_id: uuid.UUID,
        uploader_id: uuid.UUID,
        limit: int = 100,
    ) -> VideoUploadActivityListResponse:
        """Return newest-first activity for an owned upload."""

        video = await self.__get_owned_upload(public_id, uploader_id)
        safe_limit = max(1, min(limit, 200))
        statement = (
            select(VideoUploadActivity)
            .where(col(VideoUploadActivity.video_id) == video.id)
            .order_by(col(VideoUploadActivity.created_at).desc())
            .limit(safe_limit)
        )
        rows = (await self._session.execute(statement)).scalars().all()

        return VideoUploadActivityListResponse(
            items=[
                VideoUploadActivityItem(
                    id=row.id,
                    event_type=row.event_type,
                    message=row.message,
                    metadata=row.metadata_,
                    created_at=row.created_at,
                )
                for row in rows
            ],
        )

    @staticmethod
    def __derive_list_status(
        *,
        status: str,
        progress_rows: list[VideoRenditionProgress],
    ) -> str:
        """READY only when every ladder rung is READY; otherwise keep processing."""

        normalized = status.upper()

        if normalized == _STATUS_FAILED:
            return _STATUS_FAILED

        if not progress_rows:
            return status

        if all(row.status.upper() == _STATUS_READY for row in progress_rows):
            return _STATUS_READY

        if any(
            row.status.upper()
            in {_STATUS_READY, "ENCODING", "QUEUED", "PENDING"}
            for row in progress_rows
        ):
            return "ENCODING"

        return status

    @staticmethod
    def __to_list_item(
        video: Video,
        *,
        progress_rows: list[VideoRenditionProgress] | None = None,
        status_override: str | None = None,
        overall_override: float | None = None,
    ) -> VideoUploadListItem:
        """Map a Video row to a compact list item for the studio UI."""

        assert video.public_id is not None

        rows = progress_rows or []
        raw_status = status_override or video.status or _STATUS_PENDING
        status_value = VideoUploadService.__derive_list_status(
            status=raw_status,
            progress_rows=rows,
        )
        overall = (
            overall_override
            if overall_override is not None
            else VideoUploadService.__overall_progress(
                status=status_value,
                renditions=rows,
            )
        )
        stream_ready = any(row.status.upper() == _STATUS_READY for row in rows)

        return VideoUploadListItem(
            id=video.id,
            public_id=video.public_id,
            video_id=video.video_id,
            status=status_value,
            title=video.title,
            original_filename=video.original_filename,
            source_bytes=video.source_bytes,
            error_code=video.error_code,
            error_message=video.error_message,
            overall_progress_pct=overall,
            resumable=status_value.upper() in _RESUMABLE_STATUSES,
            stream_ready=stream_ready,
            created_at=video.created_at,
            updated_at=video.updated_at,
        )

    @staticmethod
    def __rung_progress_pct(row: VideoRenditionProgress) -> float:
        """Normalize a single ladder row to 0–100 progress."""

        normalized = row.status.upper()

        if normalized == _STATUS_READY:
            return _PROGRESS_COMPLETE_PCT

        if normalized == _STATUS_FAILED:
            return _PROGRESS_NONE_PCT

        return max(
            _PROGRESS_NONE_PCT,
            min(_PROGRESS_COMPLETE_PCT, float(row.progress_pct)),
        )

    @staticmethod
    def __overall_progress(
        *,
        status: str,
        renditions: list[VideoRenditionProgress],
    ) -> float:
        if status in _PROGRESS_IDLE_STATUSES:
            return _PROGRESS_NONE_PCT

        if not renditions:
            return _PROGRESS_PRE_LADDER_BY_STATUS.get(
                status,
                _PROGRESS_ENCODING_START_PCT,
            )

        rung_avg = sum(
            VideoUploadService.__rung_progress_pct(row) for row in renditions
        ) / max(len(renditions), 1)

        if rung_avg >= _PROGRESS_COMPLETE_PCT:
            return _PROGRESS_COMPLETE_PCT

        # Map average rung progress onto the post-upload portion of the bar.
        encode_share = (
            rung_avg / _PROGRESS_COMPLETE_PCT
        ) * _PROGRESS_ENCODE_SPAN_PCT

        return round(_PROGRESS_ENCODING_START_PCT + encode_share, 1)
