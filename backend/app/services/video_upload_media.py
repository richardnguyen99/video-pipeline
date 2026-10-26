"""Catalog thumbnail and sample-image operations for video uploads."""

from __future__ import annotations

import uuid
from io import BytesIO
from pathlib import PurePosixPath

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import col, select

from app.models.video import Video, VideoImageUrl, VideoSampleImageUrl
from app.schemas.video_upload import VideoMediaImageItem, VideoMediaResponse
from app.storage.client import ObjectStorageClient

_THUMBNAIL_TYPES = frozenset({"large", "list", "small"})
_SAMPLE_TYPES = frozenset({"sample_l", "sample_s"})
_IMAGE_CONTENT_TYPES = frozenset(
    {
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
        "image/gif",
    },
)
_MAX_IMAGE_BYTES = 12 * 1024 * 1024
_MAX_SAMPLE_FILES_PER_REQUEST = 50


class VideoUploadMediaMixin:
    """Media attach/list/delete helpers mixed into ``VideoUploadService``."""

    _session: AsyncSession
    _storage: ObjectStorageClient

    async def assert_owned_upload(
        self,
        *,
        public_id: uuid.UUID,
        uploader_id: uuid.UUID,
    ) -> Video:
        """Implemented by ``VideoUploadService``."""

        raise NotImplementedError

    async def list_media(
        self,
        *,
        public_id: uuid.UUID,
        uploader_id: uuid.UUID,
    ) -> VideoMediaResponse:
        """Return catalog thumbnail and sample image rows for an upload."""

        video = await self.assert_owned_upload(
            public_id=public_id,
            uploader_id=uploader_id,
        )
        video_pk = video.id
        resolved_public_id = video.public_id

        if resolved_public_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Upload is missing a public identifier.",
            )

        return await self._media_response(
            video_pk=video_pk,
            public_id=resolved_public_id,
        )

    async def upload_thumbnail(
        self,
        *,
        public_id: uuid.UUID,
        uploader_id: uuid.UUID,
        image_type: str,
        upload: UploadFile,
    ) -> VideoMediaResponse:
        """Store one thumbnail under ``{public_id}/thumbnails/`` on streams."""

        normalized = image_type.strip().lower()

        if normalized not in _THUMBNAIL_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Invalid thumbnail type. Expected one of: "
                    f"{sorted(_THUMBNAIL_TYPES)}"
                ),
            )

        video = await self.assert_owned_upload(
            public_id=public_id,
            uploader_id=uploader_id,
        )
        video_pk = video.id
        resolved_public_id = video.public_id

        if resolved_public_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Upload is missing a public identifier.",
            )

        payload, content_type, extension = await self._read_image_upload(
            upload
        )
        object_key = f"{resolved_public_id}/thumbnails/{normalized}{extension}"
        url = await self._storage.upload_fileobj(
            object_key=object_key,
            fileobj=BytesIO(payload),
            content_type=content_type,
            bucket=self._storage.streams_bucket,
        )

        await self._session.execute(
            delete(VideoImageUrl).where(
                col(VideoImageUrl.fk_id) == video_pk,
                col(VideoImageUrl.type) == normalized,
            ),
        )
        self._session.add(
            VideoImageUrl(
                fk_id=video_pk,
                url=url,
                type=normalized,
            ),
        )
        await self._session.commit()

        return await self._media_response(
            video_pk=video_pk,
            public_id=resolved_public_id,
        )

    async def upload_samples(
        self,
        *,
        public_id: uuid.UUID,
        uploader_id: uuid.UUID,
        image_type: str,
        uploads: list[UploadFile],
    ) -> VideoMediaResponse:
        """Store sample review images under ``{public_id}/samples/`` on streams."""

        normalized = image_type.strip().lower()

        if normalized not in _SAMPLE_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Invalid sample type. Expected one of: "
                    f"{sorted(_SAMPLE_TYPES)}"
                ),
            )

        if not uploads:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one sample image is required.",
            )

        if len(uploads) > _MAX_SAMPLE_FILES_PER_REQUEST:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"At most {_MAX_SAMPLE_FILES_PER_REQUEST} sample images "
                    "per request."
                ),
            )

        video = await self.assert_owned_upload(
            public_id=public_id,
            uploader_id=uploader_id,
        )
        video_pk = video.id
        resolved_public_id = video.public_id

        if resolved_public_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Upload is missing a public identifier.",
            )

        existing = await self._session.execute(
            select(VideoSampleImageUrl)
            .where(
                col(VideoSampleImageUrl.fk_id) == video_pk,
                col(VideoSampleImageUrl.type) == normalized,
            )
            .order_by(col(VideoSampleImageUrl.id).asc()),
        )
        next_index = len(list(existing.scalars().all())) + 1

        for upload in uploads:
            payload, content_type, extension = await self._read_image_upload(
                upload
            )
            object_key = (
                f"{resolved_public_id}/samples/"
                f"{normalized}_{next_index:03d}{extension}"
            )
            url = await self._storage.upload_fileobj(
                object_key=object_key,
                fileobj=BytesIO(payload),
                content_type=content_type,
                bucket=self._storage.streams_bucket,
            )
            self._session.add(
                VideoSampleImageUrl(
                    fk_id=video_pk,
                    url=url,
                    type=normalized,
                ),
            )
            next_index += 1

        await self._session.commit()

        return await self._media_response(
            video_pk=video_pk,
            public_id=resolved_public_id,
        )

    async def delete_sample(
        self,
        *,
        public_id: uuid.UUID,
        uploader_id: uuid.UUID,
        sample_id: int,
    ) -> VideoMediaResponse:
        """Remove one sample image from storage and ``video_sample_image_url``."""

        video = await self.assert_owned_upload(
            public_id=public_id,
            uploader_id=uploader_id,
        )
        video_pk = video.id
        resolved_public_id = video.public_id

        if resolved_public_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Upload is missing a public identifier.",
            )

        result = await self._session.execute(
            select(VideoSampleImageUrl).where(
                col(VideoSampleImageUrl.id) == sample_id,
                col(VideoSampleImageUrl.fk_id) == video_pk,
            ),
        )
        row = result.scalar_one_or_none()

        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Sample image not found.",
            )

        object_key = self._storage.object_key_from_streams_url(row.url)

        if object_key is not None:
            await self._storage.delete_object(
                object_key=object_key,
                bucket=self._storage.streams_bucket,
            )

        await self._session.execute(
            delete(VideoSampleImageUrl).where(
                col(VideoSampleImageUrl.id) == sample_id,
                col(VideoSampleImageUrl.fk_id) == video_pk,
            ),
        )
        await self._session.commit()

        return await self._media_response(
            video_pk=video_pk,
            public_id=resolved_public_id,
        )

    async def _media_response(
        self,
        *,
        video_pk: int,
        public_id: uuid.UUID,
    ) -> VideoMediaResponse:
        thumbs = await self._session.execute(
            select(VideoImageUrl)
            .where(col(VideoImageUrl.fk_id) == video_pk)
            .order_by(col(VideoImageUrl.id).asc()),
        )
        samples = await self._session.execute(
            select(VideoSampleImageUrl)
            .where(col(VideoSampleImageUrl.fk_id) == video_pk)
            .order_by(col(VideoSampleImageUrl.id).asc()),
        )

        return VideoMediaResponse(
            public_id=public_id,
            video_id=video_pk,
            thumbnails=[
                VideoMediaImageItem(id=row.id, url=row.url, type=row.type)
                for row in thumbs.scalars().all()
            ],
            samples=[
                VideoMediaImageItem(id=row.id, url=row.url, type=row.type)
                for row in samples.scalars().all()
            ],
        )

    @staticmethod
    async def _read_image_upload(
        upload: UploadFile,
    ) -> tuple[bytes, str, str]:
        content_type = (upload.content_type or "image/jpeg").lower()

        if content_type not in _IMAGE_CONTENT_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported image type. Use JPEG, PNG, WebP, or GIF.",
            )

        payload = await upload.read(_MAX_IMAGE_BYTES + 1)

        if len(payload) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Empty image upload.",
            )

        if len(payload) > _MAX_IMAGE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Image exceeds the 12 MiB limit.",
            )

        name = upload.filename or "image.jpg"
        extension = PurePosixPath(name).suffix.lower()

        if extension not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
            extension = {
                "image/png": ".png",
                "image/webp": ".webp",
                "image/gif": ".gif",
            }.get(content_type, ".jpg")

        if extension == ".jpeg":
            extension = ".jpg"

        return payload, content_type, extension
