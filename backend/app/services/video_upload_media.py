"""Catalog thumbnail and sample-image operations for video uploads."""

from __future__ import annotations

import re
import uuid
from io import BytesIO
from pathlib import PurePosixPath
from urllib.parse import urlparse

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import col, select

from app.models.video import Video, VideoImageUrl, VideoSampleImageUrl
from app.schemas.video_upload import VideoMediaImageItem, VideoMediaResponse
from app.storage.client import ObjectStorageClient

_THUMBNAIL_TYPES = frozenset({"large", "list", "small"})
_SAMPLE_TYPES = frozenset({"sample_l", "sample_s"})
# DMM-style filename suffixes: large→pl, list→pt, small→ps
_THUMBNAIL_SUFFIX_BY_TYPE: dict[str, str] = {
    "large": "pl",
    "list": "pt",
    "small": "ps",
}
# sample_s → {cid}-{n}.jpg ; sample_l → {cid}jp-{n}.jpg
_SAMPLE_INFIX_BY_TYPE: dict[str, str] = {
    "sample_s": "",
    "sample_l": "jp",
}
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
_MAX_SAMPLE_INDEX = 99
_CID_SAFE_PATTERN = re.compile(r"[^a-z0-9]+")
_SAMPLE_CATALOG_PATTERN = re.compile(
    r"^([a-z]*\d+)(jp)?-([1-9]\d*)$",
)
_SAMPLE_NEAR_MISS_PATTERN = re.compile(
    r"^[a-z]*\d+(jp)?-.+$",
)


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
        """Store one thumbnail under ``{public_id}/thumbnails/`` on streams.

        Object basename follows ``{cid}{pl|pt|ps}.jpg`` (catalog convention).
        """

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

        catalog_cid = self.__resolve_catalog_cid(video)
        payload, content_type, extension = await self._read_image_upload(
            upload
        )
        basename = self.__thumbnail_basename(
            catalog_cid=catalog_cid,
            image_type=normalized,
            extension=extension,
        )
        self.__assert_optional_filename_matches(
            upload.filename,
            video=video,
            image_type=normalized,
            kind="thumbnail",
        )
        object_key = f"{resolved_public_id}/thumbnails/{basename}"
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
        """Store sample review images under ``{public_id}/samples/`` on streams.

        Object basename follows ``{cid}-{n}.jpg`` (sample_s) or
        ``{cid}jp-{n}.jpg`` (sample_l).
        """

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

        catalog_cid = self.__resolve_catalog_cid(video)
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
            basename = self.__sample_basename(
                catalog_cid=catalog_cid,
                image_type=normalized,
                index=next_index,
                extension=extension,
            )
            self.__assert_optional_filename_matches(
                upload.filename,
                video=video,
                image_type=normalized,
                kind="sample",
            )
            object_key = f"{resolved_public_id}/samples/{basename}"
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

    async def add_thumbnail_link(
        self,
        *,
        public_id: uuid.UUID,
        uploader_id: uuid.UUID,
        image_type: str,
        url: str,
    ) -> VideoMediaResponse:
        """Store an external thumbnail URL in the DB only (no object storage)."""

        normalized = image_type.strip().lower()

        if normalized not in _THUMBNAIL_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Invalid thumbnail type. Expected one of: "
                    f"{sorted(_THUMBNAIL_TYPES)}"
                ),
            )

        cleaned_url = self.__validate_external_image_url(url)
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

        await self._session.execute(
            delete(VideoImageUrl).where(
                col(VideoImageUrl.fk_id) == video_pk,
                col(VideoImageUrl.type) == normalized,
            ),
        )
        self._session.add(
            VideoImageUrl(
                fk_id=video_pk,
                url=cleaned_url,
                type=normalized,
            ),
        )
        await self._session.commit()

        return await self._media_response(
            video_pk=video_pk,
            public_id=resolved_public_id,
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

        normalized = image_type.strip().lower()

        if normalized not in _SAMPLE_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Invalid sample type. Expected one of: "
                    f"{sorted(_SAMPLE_TYPES)}"
                ),
            )

        cleaned_url = self.__validate_external_image_url(url)
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

        self._session.add(
            VideoSampleImageUrl(
                fk_id=video_pk,
                url=cleaned_url,
                type=normalized,
            ),
        )
        await self._session.commit()

        return await self._media_response(
            video_pk=video_pk,
            public_id=resolved_public_id,
        )

    async def delete_thumbnail(
        self,
        *,
        public_id: uuid.UUID,
        uploader_id: uuid.UUID,
        image_type: str,
    ) -> VideoMediaResponse:
        """Remove catalog thumbnail(s) of one type from storage and DB."""

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

        result = await self._session.execute(
            select(VideoImageUrl).where(
                col(VideoImageUrl.fk_id) == video_pk,
                col(VideoImageUrl.type) == normalized,
            ),
        )
        rows = list(result.scalars().all())

        if not rows:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Thumbnail not found.",
            )

        for row in rows:
            object_key = self._storage.object_key_from_streams_url(row.url)

            if object_key is not None:
                await self._storage.delete_object(
                    object_key=object_key,
                    bucket=self._storage.streams_bucket,
                )

        await self._session.execute(
            delete(VideoImageUrl).where(
                col(VideoImageUrl.fk_id) == video_pk,
                col(VideoImageUrl.type) == normalized,
            ),
        )
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

    @staticmethod
    def __validate_external_image_url(url: str) -> str:
        cleaned = url.strip()

        if not cleaned:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Image URL is required.",
            )

        parsed = urlparse(cleaned)

        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Image URL must be an absolute http or https URL.",
            )

        return cleaned

    @staticmethod
    def __resolve_catalog_cid(video: Video) -> str:
        """Prefer ``video.cid``; fall back to a sanitized ``video_id``."""

        raw = (video.cid or video.video_id or "").strip().lower()
        cleaned = _CID_SAFE_PATTERN.sub("", raw)

        if not cleaned:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Video is missing a catalog cid. Set cid (or video_id) "
                    "before uploading thumbnails or sample images."
                ),
            )

        return cleaned

    @staticmethod
    def __thumbnail_basename(
        *,
        catalog_cid: str,
        image_type: str,
        extension: str,
    ) -> str:
        suffix = _THUMBNAIL_SUFFIX_BY_TYPE[image_type]

        return f"{catalog_cid}{suffix}{extension}"

    @staticmethod
    def __sample_basename(
        *,
        catalog_cid: str,
        image_type: str,
        index: int,
        extension: str,
    ) -> str:
        infix = _SAMPLE_INFIX_BY_TYPE[image_type]

        return f"{catalog_cid}{infix}-{index}{extension}"

    @staticmethod
    def __parse_code_token(raw: str) -> tuple[str, int] | None:
        """Split a product code into ``(letter_prefix, numeric_value)``.

        Separators and letter case are ignored. Leading zeros on the numeric
        segment do not matter (``xyz004`` and ``xyz00004`` compare equal).
        Optional trailing letter tails (e.g. ``bod``) are dropped so alias
        variants still share the same product key.
        """

        cleaned = _CID_SAFE_PATTERN.sub("", (raw or "").strip().lower())

        if not cleaned:
            return None

        match = re.match(r"^([a-z]*)(\d+)", cleaned)

        if match is None:
            return None

        return match.group(1), int(match.group(2))

    @staticmethod
    def __video_code_keys(video: Video) -> set[tuple[str, int]]:
        keys: set[tuple[str, int]] = set()

        for raw in (video.cid, video.video_id):
            parsed = VideoUploadMediaMixin.__parse_code_token(raw or "")

            if parsed is not None:
                keys.add(parsed)

        return keys

    @staticmethod
    def __catalog_shape(
        stem: str,
        *,
        kind: str,
    ) -> tuple[str, str, int | None] | None:
        """Return catalog parts when ``stem`` matches a known pattern.

        Thumbnails: ``(product_stem, type_marker, None)`` for
        ``{code}{marker}`` (any trailing letter run).

        Samples: ``(product_stem, type_marker, index)`` for
        ``{code}-{n}`` / ``{code}jp-{n}`` where ``n`` is a positive integer.
        """

        lowered = stem.lower()

        if kind == "thumbnail":
            match = re.match(r"^([a-z]*\d+)([a-z]+)$", lowered)

            if match is None:
                return None

            return match.group(1), match.group(2), None

        match = _SAMPLE_CATALOG_PATTERN.match(lowered)

        if match is None:
            return None

        marker = "jp" if match.group(2) else ""
        index = int(match.group(3))

        return match.group(1), marker, index

    @staticmethod
    def __assert_optional_filename_matches(
        filename: str | None,
        *,
        video: Video,
        image_type: str,
        kind: str,
    ) -> None:
        """Loosely validate catalog-shaped upload names against the video code.

        Generic browser names (e.g. ``image.png``, ``DSC_0001.jpg``) are allowed
        and rewritten to the canonical key.

        Catalog-shaped names must:
        * share the same letter prefix + numeric value as ``video.cid`` /
          ``video.video_id`` (zero-padding and separators ignored),
        * use the type marker that matches the selected image type
          (``pl``/``pt``/``ps`` or sample ```` / ``jp``), and
        * for samples, use a positive index not greater than
          ``_MAX_SAMPLE_INDEX``.

        Near-miss sample names (product code + hyphen + non-numeric junk)
        are rejected instead of being treated as generic.
        """

        if filename is None or not filename.strip():
            return

        stem = PurePosixPath(filename).stem
        lowered = stem.lower()
        shape = VideoUploadMediaMixin.__catalog_shape(stem, kind=kind)

        if shape is None:

            if kind == "sample" and _SAMPLE_NEAR_MISS_PATTERN.match(lowered):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Invalid sample filename '{filename}'. "
                        "Expected '{cid}-{n}.jpg' or '{cid}jp-{n}.jpg' "
                        "where n is a positive integer."
                    ),
                )

            return

        product_stem, type_marker, sample_index = shape
        file_code = VideoUploadMediaMixin.__parse_code_token(product_stem)
        video_keys = VideoUploadMediaMixin.__video_code_keys(video)

        if file_code is None or not video_keys:
            return

        if file_code not in video_keys:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Invalid {kind} filename '{filename}'. "
                    "Product code does not match this video "
                    f"(cid={video.cid!r}, video_id={video.video_id!r})."
                ),
            )

        if kind == "thumbnail":
            expected_marker = _THUMBNAIL_SUFFIX_BY_TYPE[image_type]
        else:
            expected_marker = _SAMPLE_INFIX_BY_TYPE[image_type]

        if type_marker != expected_marker:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Invalid {kind} filename '{filename}'. "
                    f"Type marker '{type_marker or '(none)'}' does not match "
                    f"selected type '{image_type}' "
                    f"(expected '{expected_marker or '(none)'}')."
                ),
            )

        if sample_index is not None and sample_index > _MAX_SAMPLE_INDEX:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Invalid sample filename '{filename}'. "
                    f"Sample index {sample_index} exceeds the maximum "
                    f"allowed ({_MAX_SAMPLE_INDEX})."
                ),
            )
