"""User video upload service: create row, presign multipart, complete."""

from __future__ import annotations

import math
import re
import uuid
from pathlib import PurePosixPath

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from types_aiobotocore_s3.type_defs import CompletedPartTypeDef

from app.models.video import Video
from app.schemas.video_upload import (
    PresignedPart,
    VideoUploadCompleteRequest,
    VideoUploadCreateRequest,
    VideoUploadCreateResponse,
    VideoUploadPartsResponse,
    VideoUploadStatusResponse,
)
from app.storage.client import ObjectStorageClient

_SAFE_FILENAME = re.compile(r"[^A-Za-z0-9._-]+")
_STATUS_PENDING = "PENDING"
_STATUS_UPLOADED = "UPLOADED"
_STATUS_FAILED = "FAILED"
_ORIGIN_UPLOAD = "upload"
_MAX_PRESIGN_BATCH = 100


class VideoUploadService:
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
    ) -> VideoUploadCreateResponse:
        """Create a video row and return presigned multipart part URLs."""

        public_id = uuid.uuid4()
        extension = self.__extension_for(payload.filename)
        source_key = f"{public_id}/source{extension}"
        content_type = payload.content_type or "application/octet-stream"

        multipart_upload_id = await self._storage.create_multipart_upload(
            object_key=source_key,
            content_type=content_type,
        )

        video_code = payload.video_code or f"upl-{public_id.hex}"
        title = payload.title or PurePosixPath(payload.filename).stem

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

        return self.__to_status(video)

    async def get_status(
        self,
        *,
        public_id: uuid.UUID,
        uploader_id: uuid.UUID,
    ) -> VideoUploadStatusResponse:
        """Return status for an upload owned by the current user."""

        video = await self.__get_owned_upload(public_id, uploader_id)

        return self.__to_status(video)

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

    @staticmethod
    def __to_status(video: Video) -> VideoUploadStatusResponse:
        """Map a Video row to the status response schema."""

        assert video.public_id is not None

        return VideoUploadStatusResponse(
            id=video.id,
            public_id=video.public_id,
            status=video.status or _STATUS_PENDING,
            original_filename=video.original_filename,
            source_key=video.source_key,
            source_bytes=video.source_bytes,
            title=video.title,
            error_code=video.error_code,
            error_message=video.error_message,
            ready_at=video.ready_at,
            created_at=video.created_at,
            updated_at=video.updated_at,
        )
