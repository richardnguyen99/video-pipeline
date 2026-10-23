"""Unit tests for ``app.services.video_upload``."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional, cast
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from app.models.video import Video
from app.schemas.video_upload import (
    CompletedPart,
    VideoUploadCompleteRequest,
    VideoUploadCreateRequest,
)
from app.services.video_upload import VideoUploadService


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class _ScalarsSpy:
    def __init__(self, rows: list[Any]) -> None:
        self._rows = rows

    def all(self) -> list[Any]:
        return list(self._rows)


class _ResultSpy:
    def __init__(
        self, row: Any = None, *, rows: Optional[list[Any]] = None
    ) -> None:
        self._row = row
        self._rows = rows if rows is not None else []

    def scalar_one_or_none(self) -> Any:
        return self._row

    def scalars(self) -> _ScalarsSpy:
        return _ScalarsSpy(self._rows)


class _SessionSpy:
    def __init__(
        self,
        *,
        video: Optional[Video] = None,
        renditions: Optional[list[Any]] = None,
    ) -> None:
        self.added: list[Any] = []
        self.committed = 0
        self.refreshed: list[Any] = []
        self._video = video
        self._renditions = list(renditions or [])
        self._next_id = 1

    def add(self, obj: Any) -> None:
        if isinstance(obj, Video) and getattr(obj, "id", None) is None:
            obj.id = self._next_id
            self._next_id += 1

        if isinstance(obj, Video) and obj.created_at is None:
            obj.created_at = _now()

        if isinstance(obj, Video) and obj.updated_at is None:
            obj.updated_at = _now()

        self.added.append(obj)
        self._video = obj

    async def commit(self) -> None:
        self.committed += 1

    async def refresh(self, obj: Any) -> None:
        self.refreshed.append(obj)

    async def execute(self, _statement: Any) -> _ResultSpy:
        return _ResultSpy(self._video, rows=self._renditions)


class _StorageSpy:
    def __init__(self) -> None:
        self.create_calls: list[dict[str, str]] = []
        self.presign_calls: list[dict[str, Any]] = []
        self.complete_calls: list[dict[str, Any]] = []
        self.head_calls: list[str] = []
        self.complete_error: Optional[Exception] = None
        self.head_size: Optional[int] = 1024

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


def _service(
    session: _SessionSpy,
    storage: _StorageSpy,
) -> VideoUploadService:
    return VideoUploadService(
        session=cast(Any, session),
        storage=cast(Any, storage),
    )


def _pending_video(
    *,
    uploader_id: UUID,
    public_id: Optional[UUID] = None,
    status: str = "PENDING",
    source_key: str = "pid/source.mp4",
) -> Video:
    pid = public_id or uuid4()

    return Video(
        id=42,
        video_id=f"upl-{pid.hex}",
        title="clip",
        origin="upload",
        public_id=pid,
        uploader_id=uploader_id,
        original_filename="clip.mp4",
        source_key=source_key,
        source_bytes=16 * 1024 * 1024,
        status=status,
        created_at=_now(),
        updated_at=_now(),
    )


@pytest.mark.asyncio
async def test_create_upload_persists_pending_row_and_presigns_first_batch() -> (
    None
):
    session = _SessionSpy()
    storage = _StorageSpy()
    service = _service(session, storage)
    uploader_id = uuid4()
    payload = VideoUploadCreateRequest(
        filename="Aimi Yoshikawa - TEAM-058.mp4",
        content_type="video/mp4",
        size_bytes=24 * 1024 * 1024,
        part_size_bytes=8 * 1024 * 1024,
        title="TEAM-058",
    )

    result = await service.create_upload(
        uploader_id=uploader_id,
        payload=payload,
    )

    assert session.committed == 1
    assert len(session.added) == 1
    video = session.added[0]
    assert isinstance(video, Video)
    assert video.origin == "upload"
    assert video.status == "PENDING"
    assert video.uploader_id == uploader_id
    assert video.source_key is not None
    assert video.source_key.endswith("/source.mp4")
    assert result.status == "PENDING"
    assert result.part_count == 3
    assert len(result.parts) == 3
    assert result.parts[0].part_number == 1
    assert storage.create_calls[0]["content_type"] == "video/mp4"
    assert len(storage.presign_calls) == 3


@pytest.mark.asyncio
async def test_create_upload_caps_initial_presign_batch_at_100() -> None:
    session = _SessionSpy()
    storage = _StorageSpy()
    service = _service(session, storage)
    payload = VideoUploadCreateRequest(
        filename="large.mp4",
        size_bytes=900 * 8 * 1024 * 1024,
        part_size_bytes=8 * 1024 * 1024,
    )

    result = await service.create_upload(
        uploader_id=uuid4(),
        payload=payload,
    )

    assert result.part_count == 900
    assert len(result.parts) == 100
    assert result.parts[-1].part_number == 100


@pytest.mark.asyncio
async def test_create_upload_uses_bin_extension_for_unknown_suffix() -> None:
    session = _SessionSpy()
    storage = _StorageSpy()
    service = _service(session, storage)
    payload = VideoUploadCreateRequest(
        filename="archive",
        size_bytes=1024 * 1024 * 8,
    )

    result = await service.create_upload(
        uploader_id=uuid4(),
        payload=payload,
    )

    assert result.source_key.endswith("/source.bin")


@pytest.mark.asyncio
async def test_create_upload_rejects_duplicate_video_code_without_upsert() -> (
    None
):
    existing = Video(
        id=7,
        video_id="TEAM-055",
        title="Old title",
        origin="legacy",
        public_id=uuid4(),
        status="READY",
        created_at=_now(),
        updated_at=_now(),
    )
    session = _SessionSpy(video=existing)
    storage = _StorageSpy()
    service = _service(session, storage)
    payload = VideoUploadCreateRequest(
        filename="new.mp4",
        size_bytes=8 * 1024 * 1024,
        video_code="TEAM-055",
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.create_upload(
            uploader_id=uuid4(),
            uploader_role="user",
            payload=payload,
        )

    assert exc_info.value.status_code == 409
    assert exc_info.value.detail == (
        "This video code is already in use. Choose a different code."
    )
    assert storage.create_calls == []


@pytest.mark.asyncio
async def test_create_upload_duplicate_video_code_admin_gets_structured_detail() -> (
    None
):
    existing = Video(
        id=798,
        video_id="TEAM-055",
        title="Old title",
        origin="legacy",
        public_id=uuid4(),
        status=None,
        created_at=_now(),
        updated_at=_now(),
    )
    session = _SessionSpy(video=existing)
    storage = _StorageSpy()
    service = _service(session, storage)
    payload = VideoUploadCreateRequest(
        filename="new.mp4",
        size_bytes=8 * 1024 * 1024,
        video_code="TEAM-055",
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.create_upload(
            uploader_id=uuid4(),
            uploader_role="admin",
            payload=payload,
        )

    assert exc_info.value.status_code == 409
    detail = exc_info.value.detail
    assert isinstance(detail, dict)
    assert detail.get("code") == "VIDEO_ID_EXISTS"
    assert "id=798" in str(detail.get("message", ""))
    assert detail.get("existing", {}).get("video_id") == "TEAM-055"
    assert storage.create_calls == []


@pytest.mark.asyncio
async def test_create_upload_upsert_forbidden_for_non_admin() -> None:
    existing = Video(
        id=7,
        video_id="TEAM-055",
        title="Old title",
        origin="legacy",
        public_id=uuid4(),
        status="READY",
        created_at=_now(),
        updated_at=_now(),
    )
    session = _SessionSpy(video=existing)
    storage = _StorageSpy()
    service = _service(session, storage)
    payload = VideoUploadCreateRequest(
        filename="new.mp4",
        size_bytes=8 * 1024 * 1024,
        video_code="TEAM-055",
        allow_upsert=True,
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.create_upload(
            uploader_id=uuid4(),
            uploader_role="user",
            payload=payload,
        )

    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_create_upload_admin_upserts_existing_video_code() -> None:
    public_id = uuid4()
    existing = Video(
        id=7,
        video_id="TEAM-055",
        title="Old title",
        origin="legacy",
        public_id=public_id,
        status="READY",
        created_at=_now(),
        updated_at=_now(),
    )
    session = _SessionSpy(video=existing)
    storage = _StorageSpy()
    service = _service(session, storage)
    admin_id = uuid4()
    payload = VideoUploadCreateRequest(
        filename="backfill.mp4",
        content_type="video/mp4",
        size_bytes=16 * 1024 * 1024,
        title="Backfilled",
        video_code="TEAM-055",
        allow_upsert=True,
        part_size_bytes=8 * 1024 * 1024,
    )

    result = await service.create_upload(
        uploader_id=admin_id,
        uploader_role="admin",
        payload=payload,
    )

    assert session.committed == 1
    assert len(session.added) == 0
    assert existing.title == "Backfilled"
    assert existing.origin == "upload"
    assert existing.uploader_id == admin_id
    assert existing.status == "PENDING"
    assert existing.source_key is not None
    assert existing.source_key.endswith("/source.mp4")
    assert result.id == 7
    assert result.public_id == public_id
    assert result.status == "PENDING"
    assert len(storage.create_calls) == 1


@pytest.mark.asyncio
async def test_presign_parts_returns_requested_urls() -> None:
    uploader_id = uuid4()
    public_id = uuid4()
    video = _pending_video(uploader_id=uploader_id, public_id=public_id)
    session = _SessionSpy(video=video)
    storage = _StorageSpy()
    service = _service(session, storage)

    result = await service.presign_parts(
        public_id=public_id,
        uploader_id=uploader_id,
        multipart_upload_id="upload-id-1",
        part_numbers=[3, 1, 1, 2],
    )

    assert [part.part_number for part in result.parts] == [1, 2, 3]
    assert len(storage.presign_calls) == 3


@pytest.mark.asyncio
async def test_presign_parts_rejects_empty_part_numbers() -> None:
    uploader_id = uuid4()
    public_id = uuid4()
    session = _SessionSpy(
        video=_pending_video(uploader_id=uploader_id, public_id=public_id),
    )
    service = _service(session, _StorageSpy())

    with pytest.raises(HTTPException) as exc_info:
        await service.presign_parts(
            public_id=public_id,
            uploader_id=uploader_id,
            multipart_upload_id="upload-id-1",
            part_numbers=[0, -1],
        )

    assert exc_info.value.status_code == 400
    assert "valid part_number" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_presign_parts_rejects_more_than_100_parts() -> None:
    uploader_id = uuid4()
    public_id = uuid4()
    session = _SessionSpy(
        video=_pending_video(uploader_id=uploader_id, public_id=public_id),
    )
    service = _service(session, _StorageSpy())

    with pytest.raises(HTTPException) as exc_info:
        await service.presign_parts(
            public_id=public_id,
            uploader_id=uploader_id,
            multipart_upload_id="upload-id-1",
            part_numbers=list(range(1, 102)),
        )

    assert exc_info.value.status_code == 400
    assert "At most 100 parts" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_presign_parts_rejects_non_pending_status() -> None:
    uploader_id = uuid4()
    public_id = uuid4()
    session = _SessionSpy(
        video=_pending_video(
            uploader_id=uploader_id,
            public_id=public_id,
            status="UPLOADED",
        ),
    )
    service = _service(session, _StorageSpy())

    with pytest.raises(HTTPException) as exc_info:
        await service.presign_parts(
            public_id=public_id,
            uploader_id=uploader_id,
            multipart_upload_id="upload-id-1",
            part_numbers=[1],
        )

    assert exc_info.value.status_code == 400
    assert "not accepting parts" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_complete_upload_marks_uploaded_and_quotes_etags(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    published: list[dict[str, object]] = []

    async def _publish(payload: dict[str, object]) -> None:
        published.append(payload)

    monkeypatch.setattr(
        "app.services.video_upload.publish_transcode_message",
        _publish,
    )

    async def _noop_probe(_self: object, _video: object) -> None:
        return None

    monkeypatch.setattr(
        VideoUploadService,
        "_VideoUploadService__probe_source_metadata",
        _noop_probe,
    )
    monkeypatch.setattr(
        "app.services.video_upload.asyncio.create_task",
        lambda *_args, **_kwargs: None,
    )

    uploader_id = uuid4()
    public_id = uuid4()
    video = _pending_video(uploader_id=uploader_id, public_id=public_id)
    session = _SessionSpy(video=video)
    storage = _StorageSpy()
    storage.head_size = 3412766169
    service = _service(session, storage)
    payload = VideoUploadCompleteRequest(
        multipart_upload_id="upload-id-1",
        parts=[
            CompletedPart(part_number=2, etag="bbb"),
            CompletedPart(part_number=1, etag='"aaa"'),
        ],
    )

    result = await service.complete_upload(
        public_id=public_id,
        uploader_id=uploader_id,
        payload=payload,
    )

    assert result.status == "UPLOADED"
    assert result.source_bytes == 3412766169
    assert session.committed >= 1
    assert storage.complete_calls[0]["parts"] == [
        {"ETag": '"aaa"', "PartNumber": 1},
        {"ETag": '"bbb"', "PartNumber": 2},
    ]
    assert len(published) == 1
    assert published[0]["public_id"] == str(public_id)


@pytest.mark.asyncio
async def test_complete_upload_marks_failed_when_storage_errors() -> None:
    uploader_id = uuid4()
    public_id = uuid4()
    video = _pending_video(uploader_id=uploader_id, public_id=public_id)
    session = _SessionSpy(video=video)
    storage = _StorageSpy()
    storage.complete_error = RuntimeError("incomplete parts")
    service = _service(session, storage)
    payload = VideoUploadCompleteRequest(
        multipart_upload_id="upload-id-1",
        parts=[CompletedPart(part_number=1, etag="etag")],
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.complete_upload(
            public_id=public_id,
            uploader_id=uploader_id,
            payload=payload,
        )

    assert exc_info.value.status_code == 400
    assert video.status == "FAILED"
    assert video.error_code == "COMPLETE_FAILED"
    assert session.committed >= 1


@pytest.mark.asyncio
async def test_get_status_returns_owned_upload() -> None:
    uploader_id = uuid4()
    public_id = uuid4()
    video = _pending_video(
        uploader_id=uploader_id,
        public_id=public_id,
        status="UPLOADED",
    )
    session = _SessionSpy(video=video)
    service = _service(session, _StorageSpy())

    result = await service.get_status(
        public_id=public_id,
        uploader_id=uploader_id,
    )

    assert result.public_id == public_id
    assert result.status == "UPLOADED"
    assert result.original_filename == "clip.mp4"
    assert result.renditions == []
    assert result.overall_progress_pct == 5.0


@pytest.mark.asyncio
async def test_get_status_raises_not_found_when_missing() -> None:
    session = _SessionSpy(video=None)
    service = _service(session, _StorageSpy())

    with pytest.raises(HTTPException) as exc_info:
        await service.get_status(
            public_id=uuid4(),
            uploader_id=uuid4(),
        )

    assert exc_info.value.status_code == 404
    assert "not found" in str(exc_info.value.detail).lower()
