"""User video upload service: create row, presign multipart, complete."""

# pylint: disable=broad-exception-caught

from __future__ import annotations

import asyncio
import logging
import math
import re
import uuid
from pathlib import PurePosixPath

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlmodel import col, select
from types_aiobotocore_s3.type_defs import CompletedPartTypeDef

from app.config import settings
from app.messaging.rabbitmq import publish_transcode_message
from app.messaging.transcode_progress import get_progress_snapshot
from app.messaging.transcode_worker import process_transcode_message
from app.models.video import Video, VideoRendition
from app.schemas.video_upload import (
    ExistingVideoSummary,
    PresignedPart,
    VideoCodeConflictDetail,
    VideoRenditionProgress,
    VideoUploadCompleteRequest,
    VideoUploadCreateRequest,
    VideoUploadCreateResponse,
    VideoUploadListItem,
    VideoUploadListResponse,
    VideoUploadPartsResponse,
    VideoUploadStatusResponse,
)
from app.services.video_upload_media import VideoUploadMediaMixin
from app.storage.client import ObjectStorageClient
from app.utils.media_probe import probe_media
from app.utils.query import relationship_attr

_logger = logging.getLogger("uvicorn.error")

_SAFE_FILENAME = re.compile(r"[^A-Za-z0-9._-]+")
_STATUS_PENDING = "PENDING"
_STATUS_UPLOADED = "UPLOADED"
_STATUS_FAILED = "FAILED"
_STATUS_READY = "READY"
_ORIGIN_UPLOAD = "upload"
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
            )
            self._session.add(video)

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

        return self.__to_status(video)

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

            return self.__to_status(
                video,
                renditions=None,
                progress_rows=progress_rows,
                status_override=live.status,
                overall_override=live.overall_pct,
            )

        renditions = await self.__list_renditions(video.id)

        return self.__to_status(video, renditions=renditions)

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
        result = await self._session.execute(statement)
        video = result.scalar_one_or_none()

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

        return VideoUploadStatusResponse(
            id=video.id,
            public_id=video.public_id,
            status=status_value,
            original_filename=video.original_filename,
            source_key=video.source_key,
            source_bytes=video.source_bytes,
            title=video.title,
            error_code=video.error_code,
            error_message=video.error_message,
            ready_at=video.ready_at,
            created_at=video.created_at,
            updated_at=video.updated_at,
            overall_progress_pct=overall,
            renditions=progress_rows,
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
            row.status.upper() in {_STATUS_READY, "ENCODING", "QUEUED"}
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
