"""Shared fakes for ``VideoUploadService`` / media unit tests."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional, cast
from uuid import UUID, uuid4

from app.models.video import Video
from app.services.video_upload import VideoUploadService


def now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class ScalarsSpy:
    def __init__(self, rows: list[Any]) -> None:
        self._rows = rows

    def all(self) -> list[Any]:
        return list(self._rows)


class ResultSpy:
    def __init__(
        self,
        row: Any = None,
        *,
        rows: Optional[list[Any]] = None,
        scalar_value: Any = None,
    ) -> None:
        self._row = row
        self._rows = rows if rows is not None else []
        self._scalar_value = scalar_value

    def all(self) -> list[Any]:
        return list(self._rows)

    def scalar_one_or_none(self) -> Any:
        return self._row

    def scalar_one(self) -> Any:
        if self._scalar_value is not None:
            return self._scalar_value

        return self._row

    def scalars(self) -> ScalarsSpy:
        return ScalarsSpy(self._rows)


class ListSessionSpy:
    """Session double that returns count, upload rows, then rendition rows."""

    def __init__(
        self,
        *,
        rows: list[Video],
        total: Optional[int] = None,
        renditions: Optional[list[Any]] = None,
    ) -> None:
        self._rows = list(rows)
        self._total = total if total is not None else len(self._rows)
        self._renditions = list(renditions or [])
        self._calls = 0

    async def execute(self, _statement: Any) -> ResultSpy:
        self._calls += 1

        if self._calls == 1:
            return ResultSpy(scalar_value=self._total)

        if self._calls == 2:
            return ResultSpy(rows=self._rows)

        return ResultSpy(rows=self._renditions)


class SessionSpy:
    def __init__(
        self,
        *,
        video: Optional[Video] = None,
        renditions: Optional[list[Any]] = None,
        relation_rows: Optional[dict[str, list[tuple[int]]]] = None,
    ) -> None:
        self.added: list[Any] = []
        self.committed = 0
        self.refreshed: list[Any] = []
        self._video = video
        self._renditions = list(renditions or [])
        self._relation_rows = dict(relation_rows or {})
        self._next_id = 1

    def add(self, obj: Any) -> None:
        if isinstance(obj, Video) and getattr(obj, "id", None) is None:
            obj.id = self._next_id
            self._next_id += 1

        if isinstance(obj, Video) and obj.created_at is None:
            obj.created_at = now_naive()

        if isinstance(obj, Video) and obj.updated_at is None:
            obj.updated_at = now_naive()

        self.added.append(obj)
        self._video = obj

    async def commit(self) -> None:
        self.committed += 1

    async def refresh(self, obj: Any) -> None:
        self.refreshed.append(obj)

    async def execute(self, statement: Any) -> ResultSpy:
        text = str(statement).lower()

        for table_name, rows in self._relation_rows.items():
            if table_name in text:
                return ResultSpy(rows=list(rows))

        if any(
            name in text
            for name in (
                "video_actress",
                "video_maker",
                "video_genre",
                "video_series",
                "video_label",
                "video_director",
            )
        ):
            return ResultSpy(rows=[])

        if "videorendition" in text or "video_rendition" in text:
            return ResultSpy(rows=self._renditions)

        return ResultSpy(self._video, rows=self._renditions)


class MediaSessionSpy:
    """Session double for list/upload/delete media paths."""

    def __init__(
        self,
        *,
        video: Optional[Video] = None,
        thumbs: Optional[list[Any]] = None,
        samples: Optional[list[Any]] = None,
        sample_lookup: Any = None,
    ) -> None:
        self.added: list[Any] = []
        self.committed = 0
        self._video = video
        self.thumbs = list(thumbs or [])
        self.samples = list(samples or [])
        self.sample_lookup = sample_lookup
        self._next_row_id = 1

    def add(self, obj: Any) -> None:
        if getattr(obj, "id", None) is None and hasattr(obj, "url"):
            obj.id = self._next_row_id
            self._next_row_id += 1

        self.added.append(obj)

        if not hasattr(obj, "type") or getattr(obj, "url", None) is None:
            return

        type_name = type(obj).__name__

        if "Sample" in type_name:
            self.samples.append(obj)

            return

        if "Image" in type_name:
            self.thumbs = [
                row
                for row in self.thumbs
                if getattr(row, "type", None) != getattr(obj, "type", None)
            ]
            self.thumbs.append(obj)

    async def commit(self) -> None:
        self.committed += 1

    async def refresh(self, _obj: Any) -> None:
        return None

    async def execute(self, statement: Any) -> ResultSpy:
        text = str(statement).lower()

        if "video_sample_image_url" in text:
            if "delete" in text:
                if self.sample_lookup is not None:
                    sample_id = getattr(self.sample_lookup, "id", None)
                    self.samples = [
                        row
                        for row in self.samples
                        if getattr(row, "id", None) != sample_id
                    ]
                    self.sample_lookup = None

                return ResultSpy()

            if self.sample_lookup is not None and "where" in text:
                return ResultSpy(self.sample_lookup)

            return ResultSpy(rows=self.samples)

        if "video_image_url" in text:
            if "delete" in text:
                self.thumbs = []

                return ResultSpy()

            return ResultSpy(rows=self.thumbs)

        return ResultSpy(self._video)


class StorageSpy:
    def __init__(self) -> None:
        self.create_calls: list[dict[str, str]] = []
        self.presign_calls: list[dict[str, Any]] = []
        self.complete_calls: list[dict[str, Any]] = []
        self.head_calls: list[str] = []
        self.upload_fileobj_calls: list[dict[str, Any]] = []
        self.delete_object_calls: list[dict[str, str]] = []
        self.complete_error: Optional[Exception] = None
        self.head_size: Optional[int] = 1024
        self.streams_bucket = "streams"

    async def create_multipart_upload(
        self,
        *,
        object_key: str,
        content_type: str,
    ) -> str:
        self.create_calls.append(
            {
                "object_key": object_key,
                "content_type": content_type,
            }
        )

        return "upload-id-1"

    async def generate_presigned_upload_part_url(
        self,
        *,
        object_key: str,
        upload_id: str,
        part_number: int,
    ) -> str:
        self.presign_calls.append(
            {
                "object_key": object_key,
                "upload_id": upload_id,
                "part_number": part_number,
            }
        )

        return f"https://example.test/{object_key}?partNumber={part_number}"

    async def complete_multipart_upload(
        self,
        *,
        object_key: str,
        upload_id: str,
        parts: list[dict[str, object]],
    ) -> None:
        self.complete_calls.append(
            {
                "object_key": object_key,
                "upload_id": upload_id,
                "parts": parts,
            }
        )

        if self.complete_error is not None:
            raise self.complete_error

    async def head_object_size(self, *, object_key: str) -> Optional[int]:
        self.head_calls.append(object_key)

        return self.head_size

    async def upload_fileobj(
        self,
        *,
        object_key: str,
        fileobj: Any,
        content_type: Optional[str] = None,
        bucket: Optional[str] = None,
    ) -> str:
        self.upload_fileobj_calls.append(
            {
                "object_key": object_key,
                "content_type": content_type,
                "bucket": bucket,
            }
        )

        return f"http://localhost:9000/streams/{object_key}"

    def object_key_from_streams_url(self, url: str) -> Optional[str]:
        prefix = "http://localhost:9000/streams/"

        if not url.startswith(prefix):
            return None

        key = url[len(prefix) :].lstrip("/")

        return key or None

    async def delete_object(
        self,
        *,
        object_key: str,
        bucket: Optional[str] = None,
    ) -> None:
        self.delete_object_calls.append(
            {
                "object_key": object_key,
                "bucket": bucket or self.streams_bucket,
            }
        )


class UploadFileSpy:
    def __init__(
        self,
        *,
        data: bytes = b"\xff\xd8\xff",
        content_type: str = "image/jpeg",
        filename: str = "still.jpg",
    ) -> None:
        self._data = data
        self.content_type = content_type
        self.filename = filename

    async def read(self, size: int = -1) -> bytes:
        if size < 0:
            return self._data

        return self._data[:size]


def make_service(session: Any, storage: StorageSpy) -> VideoUploadService:
    return VideoUploadService(
        session=cast(Any, session),
        storage=cast(Any, storage),
    )


def pending_video(
    *,
    uploader_id: UUID,
    public_id: Optional[UUID] = None,
    status: str = "PENDING",
    source_key: str = "pid/source.mp4",
    cid: Optional[str] = "team00055",
    video_id: Optional[str] = None,
) -> Video:
    pid = public_id or uuid4()

    return Video(
        id=42,
        video_id=f"upl-{pid.hex}" if video_id is None else video_id,
        title="clip",
        cid=cid,
        origin="upload",
        public_id=pid,
        uploader_id=uploader_id,
        original_filename="clip.mp4",
        source_key=source_key,
        source_bytes=16 * 1024 * 1024,
        status=status,
        created_at=now_naive(),
        updated_at=now_naive(),
    )
