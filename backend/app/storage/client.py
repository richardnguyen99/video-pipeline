"""S3-compatible object storage client (MinIO in development)."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import BinaryIO, Optional, Union

import aioboto3
from aiobotocore.config import AioConfig
from aiobotocore.session import ClientCreatorContext
from botocore.exceptions import ClientError
from types_aiobotocore_s3.client import S3Client

from app.config import Settings, settings


class ObjectStorageClient:
    """Async helpers around an ``aioboto3`` session for the configured bucket."""

    def __init__(self, app_settings: Settings) -> None:
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

        if endpoint is not None:
            return self._session.client(
                "s3",
                endpoint_url=endpoint,
                aws_access_key_id=self._settings.object_storage_access_key,
                aws_secret_access_key=(
                    self._settings.object_storage_secret_key
                ),
                region_name=self._settings.object_storage_region,
                use_ssl=self._settings.object_storage_use_ssl,
                config=config,
            )

        return self._session.client(
            "s3",
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

    async def upload_file(
        self,
        *,
        object_key: str,
        file_path: Union[str, Path],
        content_type: Optional[str] = None,
    ) -> str:
        """Upload a local file and return its public URL.

        Args:
            object_key: Destination key in the bucket.
            file_path: Path to a file on disk.
            content_type: Optional MIME type.

        Returns:
            Public URL for the uploaded object.
        """

        extra: dict[str, str] = {}

        if content_type:
            extra["ContentType"] = content_type

        key = object_key.lstrip("/")

        async with self.s3_client() as s3:
            await s3.upload_file(
                Filename=str(file_path),
                Bucket=self.bucket,
                Key=key,
                ExtraArgs=extra,
            )

        return self.public_url(object_key)

    async def upload_fileobj(
        self,
        *,
        object_key: str,
        fileobj: BinaryIO,
        content_type: Optional[str] = None,
    ) -> str:
        """Upload a file-like object and return its public URL."""

        extra: dict[str, str] = {}

        if content_type:
            extra["ContentType"] = content_type

        key = object_key.lstrip("/")

        async with self.s3_client() as s3:
            await s3.upload_fileobj(
                Fileobj=fileobj,
                Bucket=self.bucket,
                Key=key,
                ExtraArgs=extra,
            )

        return self.public_url(object_key)

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

    async def object_exists(self, object_key: str) -> bool:
        """Return whether ``object_key`` exists in the configured bucket."""

        key = object_key.lstrip("/")

        async with self.s3_client() as s3:
            try:
                await s3.head_object(Bucket=self.bucket, Key=key)
            except ClientError as exc:
                error_code = exc.response.get("Error", {}).get("Code", "")
                status = exc.response.get("ResponseMetadata", {}).get(
                    "HTTPStatusCode",
                )

                if (
                    error_code in {"404", "NoSuchKey", "NotFound"}
                    or status == 404
                ):
                    return False

                raise

        return True

    async def ensure_local_media_public_url(self, local_path: str) -> str:
        """Ensure a local media file is in the bucket and return its URL.

        Used for ``sample_gen`` stills and local review clips
        (``video_sample_movie_url``). Uploads from disk when missing.

        Args:
            local_path: Absolute path stored on the media row.

        Returns:
            Public object-storage URL for the object.

        Raises:
            FileNotFoundError: When the local file is not readable.
        """

        path = Path(local_path)

        if not path.is_file():
            raise FileNotFoundError(
                f"sample_gen file not found on API host: {local_path}",
            )

        key = self.object_key_from_local_path(local_path)

        if not await self.object_exists(key):
            await self.upload_file(
                object_key=key,
                file_path=path,
                content_type=self._guess_content_type(path),
            )

        return self.public_url(key)

    def object_key_from_local_path(self, local_path: str) -> str:
        """Derive a stable object key from a local HLS media path.

        Examples:
            ``.../hls/<uuid>/samples/sample_01.jpg``
            → ``<uuid>/samples/sample_01.jpg``

            ``.../hls/<uuid>/review.mp4``
            → ``<uuid>/review.mp4``
        """

        path = Path(local_path)
        parts = path.parts

        if "hls" in parts:
            idx = parts.index("hls")

            if idx + 1 < len(parts):
                return "/".join(parts[idx + 1 :])

        if "samples" in parts:
            idx = parts.index("samples")
            start = max(0, idx - 1)

            return "/".join(parts[start:])

        return path.name

    async def ensure_hls_tree_public_url(self, master_local_path: str) -> str:
        """Ensure a full HLS package is in the bucket; return master public URL.

        The master playlist (``index.m3u8``) references relative quality
        playlists and ``.ts`` segments. Those must share the same object-key
        prefix so the player can resolve:

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
        master_key = self.object_key_from_local_path(str(master))

        if await self.object_exists(master_key):
            return self.public_url(master_key)

        # Upload every file under the uuid package directory.
        for file_path in package_dir.rglob("*"):
            if not file_path.is_file():
                continue

            relative = file_path.relative_to(package_dir).as_posix()
            object_key = f"{package_dir.name}/{relative}"

            await self.upload_file(
                object_key=object_key,
                file_path=file_path,
                content_type=self._guess_content_type(file_path),
            )

        return self.public_url(master_key)

    async def ensure_sample_gen_public_url(self, local_path: str) -> str:
        """Backward-compatible alias for ``ensure_local_media_public_url``."""

        return await self.ensure_local_media_public_url(local_path)


@lru_cache
def get_object_storage_client() -> ObjectStorageClient:
    """Return a process-wide storage client using global settings."""

    return ObjectStorageClient(settings)
