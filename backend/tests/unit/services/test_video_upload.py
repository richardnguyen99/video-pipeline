"""Unit tests for ``app.services.video_upload``."""

from __future__ import annotations

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
from tests.unit.services.video_upload_fakes import (
    ListSessionSpy,
    SessionSpy,
    StorageSpy,
    make_service,
    now_naive,
    pending_video,
)


@pytest.mark.asyncio
async def test_create_upload_persists_pending_row_and_presigns_first_batch() -> (
    None
):
    session = SessionSpy()
    storage = StorageSpy()
    service = make_service(session, storage)
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
    session = SessionSpy()
    storage = StorageSpy()
    service = make_service(session, storage)
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
    session = SessionSpy()
    storage = StorageSpy()
    service = make_service(session, storage)
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
        created_at=now_naive(),
        updated_at=now_naive(),
    )
    session = SessionSpy(video=existing)
    storage = StorageSpy()
    service = make_service(session, storage)
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
        created_at=now_naive(),
        updated_at=now_naive(),
    )
    session = SessionSpy(video=existing)
    storage = StorageSpy()
    service = make_service(session, storage)
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
        created_at=now_naive(),
        updated_at=now_naive(),
    )
    session = SessionSpy(video=existing)
    storage = StorageSpy()
    service = make_service(session, storage)
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
        created_at=now_naive(),
        updated_at=now_naive(),
    )
    session = SessionSpy(video=existing)
    storage = StorageSpy()
    service = make_service(session, storage)
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
    video = pending_video(uploader_id=uploader_id, public_id=public_id)
    session = SessionSpy(video=video)
    storage = StorageSpy()
    service = make_service(session, storage)

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
    session = SessionSpy(
        video=pending_video(uploader_id=uploader_id, public_id=public_id),
    )
    service = make_service(session, StorageSpy())

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
    session = SessionSpy(
        video=pending_video(uploader_id=uploader_id, public_id=public_id),
    )
    service = make_service(session, StorageSpy())

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
    session = SessionSpy(
        video=pending_video(
            uploader_id=uploader_id,
            public_id=public_id,
            status="UPLOADED",
        ),
    )
    service = make_service(session, StorageSpy())

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
    video = pending_video(uploader_id=uploader_id, public_id=public_id)
    session = SessionSpy(video=video)
    storage = StorageSpy()
    storage.head_size = 3412766169
    service = make_service(session, storage)
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
    video = pending_video(uploader_id=uploader_id, public_id=public_id)
    session = SessionSpy(video=video)
    storage = StorageSpy()
    storage.complete_error = RuntimeError("incomplete parts")
    service = make_service(session, storage)
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
async def test_get_status_returns_owned_upload(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _no_live(_public_id: UUID) -> None:
        return None

    monkeypatch.setattr(
        "app.services.video_upload.get_progress_snapshot",
        _no_live,
    )

    uploader_id = uuid4()
    public_id = uuid4()
    video = pending_video(
        uploader_id=uploader_id,
        public_id=public_id,
        status="UPLOADED",
    )
    session = SessionSpy(video=video)
    service = make_service(session, StorageSpy())

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
async def test_get_status_raises_not_found_when_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _no_live(_public_id: UUID) -> None:
        return None

    monkeypatch.setattr(
        "app.services.video_upload.get_progress_snapshot",
        _no_live,
    )

    session = SessionSpy(video=None)
    service = make_service(session, StorageSpy())

    with pytest.raises(HTTPException) as exc_info:
        await service.get_status(
            public_id=uuid4(),
            uploader_id=uuid4(),
        )

    assert exc_info.value.status_code == 404
    assert "not found" in str(exc_info.value.detail).lower()


@pytest.mark.asyncio
async def test_list_uploads_marks_resumable_after_raw_upload() -> None:
    uploader_id = uuid4()
    uploaded = pending_video(
        uploader_id=uploader_id,
        public_id=uuid4(),
        status="UPLOADED",
    )
    uploaded.title = "Resume me"
    uploaded.origin = "upload"

    pending = pending_video(
        uploader_id=uploader_id,
        public_id=uuid4(),
        status="PENDING",
    )
    pending.origin = "upload"

    failed = pending_video(
        uploader_id=uploader_id,
        public_id=uuid4(),
        status="FAILED",
    )
    failed.origin = "upload"

    ready = pending_video(
        uploader_id=uploader_id,
        public_id=uuid4(),
        status="READY",
    )
    ready.origin = "upload"

    session = ListSessionSpy(rows=[uploaded, pending, failed, ready])
    service = make_service(session, StorageSpy())

    result = await service.list_uploads(uploader_id=uploader_id)

    assert result.total == 4
    by_status = {item.status: item for item in result.items}

    assert by_status["UPLOADED"].resumable is True
    assert by_status["READY"].resumable is True
    assert by_status["PENDING"].resumable is False
    assert by_status["FAILED"].resumable is False
    assert by_status["UPLOADED"].title == "Resume me"
