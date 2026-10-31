"""S3-compatible object storage client (MinIO in development)."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import BinaryIO, Optional, Sequence, Union

import aioboto3
from aiobotocore.config import AioConfig
from aiobotocore.session import ClientCreatorContext
from botocore.exceptions import ClientError
from types_aiobotocore_s3.client import S3Client
from types_aiobotocore_s3.type_defs import (
    CompletedPartTypeDef,
    ObjectIdentifierTypeDef,
)

from app.config import Settings, settings


class ObjectStorageClient:
    """Async helpers around an ``aioboto3`` session for the configured bucket."""

    def __init__(self, app_settings: Settings = settings) -> None:
        """Bind client settings.

        Args:
            app_settings: Application settings with object-storage fields.
        """

        self._settings = app_settings
        self._session = aioboto3.Session()

    @property
    def bucket(self) -> str:
        """Return the configured bucket name."""

        return self._settings.object_storage_bucket

    @property
    def raw_uploads_bucket(self) -> str:
        """Return the private raw-uploads bucket name."""

        return self._settings.object_storage_raw_uploads_bucket

    @property
    def streams_bucket(self) -> str:
        """Return the streams (HLS / catalog media) bucket name."""

        return self._settings.object_storage_streams_bucket

    def s3_client(self) -> ClientCreatorContext[S3Client]:
        """Return an ``aioboto3`` S3 client context manager.

        Use as::

            async with storage.s3_client() as s3:
                await s3.upload_file(...)
        """

        addressing = (
            "path" if self._settings.object_storage_path_style else "virtual"
        )
        config = AioConfig(
            signature_version="s3v4",
            s3={"addressing_style": addressing},
        )
        endpoint = self._settings.object_storage_endpoint

        return self._session.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=self._settings.object_storage_access_key,
            aws_secret_access_key=self._settings.object_storage_secret_key,
            region_name=self._settings.object_storage_region,
            use_ssl=self._settings.object_storage_use_ssl,
            config=config,
        )

    def public_url(self, object_key: str) -> str:
        """Build a public URL for an object key under the public base.

        Args:
            object_key: Key inside the bucket (no leading slash required).

        Returns:
            Absolute URL suitable for API responses.
        """

        key = object_key.lstrip("/")
        base = self._settings.object_storage_public_base_url.rstrip("/")

        return f"{base}/{key}"

    def streams_public_url(self, object_key: str) -> str:
        """Build a public URL under the streams CDN/base prefix."""

        key = object_key.lstrip("/")
        base = self._settings.object_storage_streams_public_base_url.rstrip(
            "/"
        )

        return f"{base}/{key}"

    def object_key_from_streams_url(self, url: str) -> Optional[str]:
        """Extract the object key from a streams public URL, if possible."""

        base = self._settings.object_storage_streams_public_base_url.rstrip(
            "/"
        )

        if not url.startswith(base):
            return None

        key = url[len(base) :].lstrip("/")

        return key or None

    async def delete_object(
        self,
        *,
        object_key: str,
        bucket: str | None = None,
    ) -> None:
        """Delete an object; missing keys are ignored."""

        key = object_key.lstrip("/")
        target = bucket or self.bucket

        try:
            async with self.s3_client() as s3:
                await s3.delete_object(Bucket=target, Key=key)
        except ClientError as exc:
            error_code = str(exc.response.get("Error", {}).get("Code", ""))
            status = exc.response.get("ResponseMetadata", {}).get(
                "HTTPStatusCode",
            )

            if error_code in {"NotFound", "NoSuchKey", "404"} or status == 404:
                return

            raise

    async def upload_file(
        self,
        *,
        object_key: str,
        file_path: Union[str, Path],
        content_type: str | None = None,
        bucket: str | None = None,
    ) -> str:
        """Upload a local file and return its public URL.

        Args:
            object_key: Destination key in the bucket.
            file_path: Path to a file on disk.
            content_type: Optional MIME type.
            bucket: Override target bucket (default primary media bucket).

        Returns:
            Public URL for the uploaded object.
        """

        extra: dict[str, str] = {}

        if content_type is not None:
            extra["ContentType"] = content_type

        key = object_key.lstrip("/")
        target = bucket or self.bucket

        async with self.s3_client() as s3:
            await s3.upload_file(
                Filename=str(file_path),
                Bucket=target,
                Key=key,
                ExtraArgs=extra or None,
            )

        if target == self.streams_bucket:
            return self.streams_public_url(key)

        return self.public_url(key)

    async def upload_directory(
        self,
        *,
        local_dir: Union[str, Path],
        key_prefix: str,
        bucket: str | None = None,
        content_type_map: dict[str, str] | None = None,
    ) -> list[str]:
        """Upload every file under ``local_dir`` preserving relative paths."""

        root = Path(local_dir)
        prefix = key_prefix.strip("/")
        uploaded: list[str] = []
        type_map = content_type_map or {}

        for path in sorted(root.rglob("*")):
            if not path.is_file():
                continue

            rel = path.relative_to(root).as_posix()
            object_key = f"{prefix}/{rel}" if prefix else rel
            suffix = path.suffix.lower()
            content_type = type_map.get(suffix)
            url = await self.upload_file(
                object_key=object_key,
                file_path=path,
                content_type=content_type,
                bucket=bucket,
            )
            uploaded.append(url)

        return uploaded

    async def upload_fileobj(
        self,
        *,
        object_key: str,
        fileobj: BinaryIO,
        content_type: str | None = None,
        bucket: str | None = None,
    ) -> str:
        """Upload a file-like object and return its public URL."""

        extra: dict[str, str] = {}

        if content_type is not None:
            extra["ContentType"] = content_type

        key = object_key.lstrip("/")
        target = bucket or self.bucket

        async with self.s3_client() as s3:
            await s3.upload_fileobj(
                Fileobj=fileobj,
                Bucket=target,
                Key=key,
                ExtraArgs=extra or None,
            )

        if target == self.streams_bucket:
            return self.streams_public_url(key)

        return self.public_url(key)

    def _guess_content_type(self, path: Union[str, Path]) -> str:
        """Infer a MIME type from the file suffix."""

        suffix = Path(path).suffix.lower()
        mapping = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp",
            ".gif": "image/gif",
            ".mp4": "video/mp4",
            ".webm": "video/webm",
            ".m3u8": "application/vnd.apple.mpegurl",
            ".ts": "video/mp2t",
        }

        return mapping.get(suffix, "application/octet-stream")

    async def object_exists(
        self,
        object_key: str,
        *,
        bucket: str | None = None,
    ) -> bool:
        """Return whether ``object_key`` exists in the target bucket."""

        key = object_key.lstrip("/")
        target = bucket or self.bucket

        try:
            async with self.s3_client() as s3:
                await s3.head_object(Bucket=target, Key=key)
        except ClientError as exc:
            error_code = str(exc.response.get("Error", {}).get("Code", ""))
            status = exc.response.get("ResponseMetadata", {}).get(
                "HTTPStatusCode",
            )

            if error_code in {"NotFound", "NoSuchKey", "404"} or status == 404:
                return False

            raise

        return True

    async def download_bytes(
        self,
        *,
        object_key: str,
        bucket: str | None = None,
    ) -> Optional[bytes]:
        """Download an object as bytes, or None when missing."""

        key = object_key.lstrip("/")
        target = bucket or self.bucket

        try:
            async with self.s3_client() as s3:
                response = await s3.get_object(Bucket=target, Key=key)
                body = response["Body"]
                data = await body.read()
        except ClientError as exc:
            error_code = str(exc.response.get("Error", {}).get("Code", ""))
            status = exc.response.get("ResponseMetadata", {}).get(
                "HTTPStatusCode",
            )

            if error_code in {"NotFound", "NoSuchKey", "404"} or status == 404:
                return None

            raise

        return data

    async def ensure_local_media_public_url(self, local_path: str) -> str:
        """Upload a local media file when missing; return its public URL."""

        path = Path(local_path)

        if not path.is_file():
            raise FileNotFoundError(
                f"Local media file not found: {local_path}"
            )

        key = self._object_key_from_local_path(path)

        if await self.object_exists(key):
            return self.public_url(key)

        return await self.upload_file(
            object_key=key,
            file_path=path,
            content_type=self._guess_content_type(path),
        )

    def _object_key_from_local_path(self, local_path: Union[str, Path]) -> str:
        """Derive a stable object key from a known local media layout.

        Prefers segments after ``hls/`` or ``samples/`` when present so
        keys stay relative to the media package root, e.g.::

            .../hls/<uuid>/index.m3u8 → <uuid>/index.m3u8
            .../samples/<cid>/review.mp4 → <cid>/review.mp4
        """

        path = Path(local_path)
        parts = path.parts

        try:
            idx = parts.index("hls")
            start = idx + 1
        except ValueError:
            try:
                idx = parts.index("samples")
                start = idx + 1
            except ValueError:
                return path.name

        if start >= len(parts):
            return path.name

        return "/".join(parts[start:])

    async def ensure_hls_tree_public_url(self, master_local_path: str) -> str:
        """Ensure a full HLS package is in the bucket; return master public URL.

        The master playlist (``index.m3u8``) references relative quality
        playlists and ``.ts`` segments. Those must share the same object-key
        prefix so the player can resolve::

            {public_base}/{uuid}/index.m3u8
            {public_base}/{uuid}/720p/playlist.m3u8
            {public_base}/{uuid}/720p/seg_0.ts

        Uploads the entire package directory when the master object is missing.

        Args:
            master_local_path: Absolute path to the master ``index.m3u8``.

        Returns:
            Public URL of the master playlist.

        Raises:
            FileNotFoundError: When the master file is not readable.
        """

        master = Path(master_local_path)

        if not master.is_file():
            raise FileNotFoundError(
                f"HLS master playlist not found: {master_local_path}",
            )

        package_dir = master.parent
        master_key = self._object_key_from_local_path(master)

        if await self.object_exists(master_key):
            return self.public_url(master_key)

        for file_path in package_dir.rglob("*"):
            if not file_path.is_file():
                continue

            relative = file_path.relative_to(package_dir).as_posix()
            prefix = master_key.rsplit("/", 1)[0] if "/" in master_key else ""
            object_key = f"{prefix}/{relative}" if prefix else relative

            if file_path.name == master.name:
                object_key = master_key

            await self.upload_file(
                object_key=object_key,
                file_path=file_path,
                content_type=self._guess_content_type(file_path),
            )

        return self.public_url(master_key)

    async def _ensure_sample_gen_public_url(self, local_path: str) -> str:
        """Upload a generated sample media file when missing."""

        return await self.ensure_local_media_public_url(local_path)

    async def create_multipart_upload(
        self,
        *,
        object_key: str,
        content_type: str,
        bucket: str | None = None,
    ) -> str:
        """Start a multipart upload; return the S3 upload id."""

        target = bucket or self.raw_uploads_bucket

        async with self.s3_client() as s3:
            response = await s3.create_multipart_upload(
                Bucket=target,
                Key=object_key,
                ContentType=content_type,
            )

        return str(response["UploadId"])

    async def generate_presigned_upload_part_url(
        self,
        *,
        object_key: str,
        upload_id: str,
        part_number: int,
        expires_in: int = 14_400,
        bucket: str | None = None,
    ) -> str:
        """Return a presigned URL for uploading one multipart part.

        Default expiry is 4 hours so large multi-GB uploads can finish
        without the part URLs expiring mid-flight.
        """

        target = bucket or self.raw_uploads_bucket

        async with self.s3_client() as s3:
            url = await s3.generate_presigned_url(
                ClientMethod="upload_part",
                Params={
                    "Bucket": target,
                    "Key": object_key,
                    "UploadId": upload_id,
                    "PartNumber": part_number,
                },
                ExpiresIn=expires_in,
            )

        return str(url)

    async def complete_multipart_upload(
        self,
        *,
        object_key: str,
        upload_id: str,
        parts: Sequence[CompletedPartTypeDef],
        bucket: str | None = None,
    ) -> None:
        """Finalize a multipart upload with ordered part ETags."""

        target = bucket or self.raw_uploads_bucket
        completed_parts: list[CompletedPartTypeDef] = list(parts)

        async with self.s3_client() as s3:
            await s3.complete_multipart_upload(
                Bucket=target,
                Key=object_key,
                UploadId=upload_id,
                MultipartUpload={"Parts": completed_parts},
            )

    async def _abort_multipart_upload(
        self,
        *,
        object_key: str,
        upload_id: str,
        bucket: str | None = None,
    ) -> None:
        """Abort an in-progress multipart upload (internal)."""

        target = bucket or self.raw_uploads_bucket

        async with self.s3_client() as s3:
            await s3.abort_multipart_upload(
                Bucket=target,
                Key=object_key,
                UploadId=upload_id,
            )

    async def head_object_size(
        self,
        *,
        object_key: str,
        bucket: str | None = None,
    ) -> Optional[int]:
        """Return object size in bytes, or None if missing."""

        target = bucket or self.raw_uploads_bucket

        try:
            async with self.s3_client() as s3:
                response = await s3.head_object(Bucket=target, Key=object_key)
        except ClientError as exc:
            code = str(exc.response.get("Error", {}).get("Code", ""))

            if code in {"NotFound", "NoSuchKey", "404", "404 Not Found"}:
                return None

            raise

        return int(response["ContentLength"])

    async def generate_presigned_get_url(
        self,
        *,
        object_key: str,
        expires_in: int = 3600,
        bucket: str | None = None,
    ) -> str:
        """Return a presigned GET URL for reading an object (probe / workers)."""

        target = bucket or self.raw_uploads_bucket

        async with self.s3_client() as s3:
            url = await s3.generate_presigned_url(
                ClientMethod="get_object",
                Params={
                    "Bucket": target,
                    "Key": object_key,
                },
                ExpiresIn=expires_in,
            )

        return str(url)


async def purge_prefix(
    storage: ObjectStorageClient,
    prefix: str,
    bucket: str | None = None,
) -> int:
    """Delete every object under ``prefix``. Returns deleted count."""

    cleaned = prefix.lstrip("/")
    target = bucket or storage.bucket
    deleted = 0
    continuation: str | None = None

    async with storage.s3_client() as s3:
        while True:
            if continuation is None:
                response = await s3.list_objects_v2(
                    Bucket=target,
                    Prefix=cleaned,
                    MaxKeys=1000,
                )
            else:
                response = await s3.list_objects_v2(
                    Bucket=target,
                    Prefix=cleaned,
                    MaxKeys=1000,
                    ContinuationToken=continuation,
                )

            contents = response.get("Contents") or []
            objects: list[ObjectIdentifierTypeDef] = [
                {"Key": str(item["Key"])}
                for item in contents
                if item.get("Key")
            ]

            if objects:
                await s3.delete_objects(
                    Bucket=target,
                    Delete={"Objects": objects, "Quiet": True},
                )
                deleted += len(objects)

            if not response.get("IsTruncated"):
                break

            next_token = response.get("NextContinuationToken")

            if not next_token:
                break

            continuation = str(next_token)

    return deleted


@lru_cache(maxsize=1)
def get_object_storage_client() -> ObjectStorageClient:
    """Return a process-wide storage client using global settings."""

    return ObjectStorageClient(settings)
