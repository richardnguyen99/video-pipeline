"""Unit tests for ``app.services.video_upload_media`` (via VideoUploadService)."""

from __future__ import annotations

from typing import Any, cast
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.models.video import VideoImageUrl, VideoSampleImageUrl
from tests.unit.services.video_upload_fakes import (
    MediaSessionSpy,
    StorageSpy,
    UploadFileSpy,
    make_service,
    pending_video,
)


@pytest.mark.asyncio
async def test_list_media_returns_thumbnails_and_samples() -> None:
    uploader_id = uuid4()
    public_id = uuid4()
    video = pending_video(
        uploader_id=uploader_id,
        public_id=public_id,
        status="UPLOADED",
    )
    thumbs = [
        VideoImageUrl(
            id=1,
            fk_id=video.id,
            url=f"http://localhost:9000/streams/{public_id}/thumbnails/large.jpg",
            type="large",
        ),
    ]
    samples = [
        VideoSampleImageUrl(
            id=10,
            fk_id=video.id,
            url=f"http://localhost:9000/streams/{public_id}/samples/sample_s_001.jpg",
            type="sample_s",
        ),
    ]
    session = MediaSessionSpy(video=video, thumbs=thumbs, samples=samples)
    service = make_service(session, StorageSpy())

    result = await service.list_media(
        public_id=public_id,
        uploader_id=uploader_id,
    )

    assert result.public_id == public_id
    assert result.video_id == video.id
    assert len(result.thumbnails) == 1
    assert result.thumbnails[0].type == "large"
    assert len(result.samples) == 1
    assert result.samples[0].type == "sample_s"


@pytest.mark.asyncio
async def test_list_media_raises_not_found_for_missing_upload() -> None:
    session = MediaSessionSpy(video=None)
    service = make_service(session, StorageSpy())

    with pytest.raises(HTTPException) as exc_info:
        await service.list_media(
            public_id=uuid4(),
            uploader_id=uuid4(),
        )

    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_upload_thumbnail_stores_streams_object_and_row() -> None:
    uploader_id = uuid4()
    public_id = uuid4()
    video = pending_video(
        uploader_id=uploader_id,
        public_id=public_id,
        status="UPLOADED",
    )
    session = MediaSessionSpy(video=video)
    storage = StorageSpy()
    service = make_service(session, storage)

    result = await service.upload_thumbnail(
        public_id=public_id,
        uploader_id=uploader_id,
        image_type="large",
        upload=cast(Any, UploadFileSpy()),
    )

    assert session.committed >= 1
    assert len(storage.upload_fileobj_calls) == 1
    assert storage.upload_fileobj_calls[0]["bucket"] == "streams"
    assert storage.upload_fileobj_calls[0]["object_key"].endswith(
        f"{public_id}/thumbnails/team00055pl.jpg",
    )
    assert len(result.thumbnails) == 1
    assert result.thumbnails[0].type == "large"


@pytest.mark.asyncio
async def test_upload_thumbnail_rejects_invalid_type() -> None:
    uploader_id = uuid4()
    public_id = uuid4()
    video = pending_video(uploader_id=uploader_id, public_id=public_id)
    service = make_service(MediaSessionSpy(video=video), StorageSpy())

    with pytest.raises(HTTPException) as exc_info:
        await service.upload_thumbnail(
            public_id=public_id,
            uploader_id=uploader_id,
            image_type="hero",
            upload=cast(Any, UploadFileSpy()),
        )

    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_upload_thumbnail_rejects_unsupported_content_type() -> None:
    uploader_id = uuid4()
    public_id = uuid4()
    video = pending_video(uploader_id=uploader_id, public_id=public_id)
    service = make_service(MediaSessionSpy(video=video), StorageSpy())

    with pytest.raises(HTTPException) as exc_info:
        await service.upload_thumbnail(
            public_id=public_id,
            uploader_id=uploader_id,
            image_type="list",
            upload=cast(
                Any,
                UploadFileSpy(
                    content_type="application/pdf", filename="x.pdf"
                ),
            ),
        )

    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_upload_samples_appends_numbered_keys() -> None:
    uploader_id = uuid4()
    public_id = uuid4()
    video = pending_video(
        uploader_id=uploader_id,
        public_id=public_id,
        status="UPLOADED",
    )
    session = MediaSessionSpy(video=video)
    storage = StorageSpy()
    service = make_service(session, storage)

    result = await service.upload_samples(
        public_id=public_id,
        uploader_id=uploader_id,
        image_type="sample_s",
        uploads=[
            cast(Any, UploadFileSpy(filename="a.jpg")),
            cast(Any, UploadFileSpy(filename="b.jpg")),
        ],
    )

    assert session.committed >= 1
    assert len(storage.upload_fileobj_calls) == 2
    keys = [call["object_key"] for call in storage.upload_fileobj_calls]
    assert keys[0].endswith(f"{public_id}/samples/team00055-1.jpg")
    assert keys[1].endswith(f"{public_id}/samples/team00055-2.jpg")
    assert len(result.samples) == 2


@pytest.mark.asyncio
async def test_upload_samples_continues_index_after_existing() -> None:
    uploader_id = uuid4()
    public_id = uuid4()
    video = pending_video(
        uploader_id=uploader_id,
        public_id=public_id,
        status="UPLOADED",
    )
    existing = VideoSampleImageUrl(
        id=1,
        fk_id=video.id,
        url=f"http://localhost:9000/streams/{public_id}/samples/sample_s_001.jpg",
        type="sample_s",
    )
    session = MediaSessionSpy(video=video, samples=[existing])
    storage = StorageSpy()
    service = make_service(session, storage)

    result = await service.upload_samples(
        public_id=public_id,
        uploader_id=uploader_id,
        image_type="sample_s",
        uploads=[cast(Any, UploadFileSpy(filename="c.jpg"))],
    )

    assert storage.upload_fileobj_calls[0]["object_key"].endswith(
        f"{public_id}/samples/team00055-2.jpg",
    )
    assert len(result.samples) == 2


@pytest.mark.asyncio
async def test_upload_samples_rejects_empty_batch() -> None:
    uploader_id = uuid4()
    public_id = uuid4()
    video = pending_video(uploader_id=uploader_id, public_id=public_id)
    service = make_service(MediaSessionSpy(video=video), StorageSpy())

    with pytest.raises(HTTPException) as exc_info:
        await service.upload_samples(
            public_id=public_id,
            uploader_id=uploader_id,
            image_type="sample_l",
            uploads=[],
        )

    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_upload_samples_rejects_invalid_type() -> None:
    uploader_id = uuid4()
    public_id = uuid4()
    video = pending_video(uploader_id=uploader_id, public_id=public_id)
    service = make_service(MediaSessionSpy(video=video), StorageSpy())

    with pytest.raises(HTTPException) as exc_info:
        await service.upload_samples(
            public_id=public_id,
            uploader_id=uploader_id,
            image_type="gallery",
            uploads=[cast(Any, UploadFileSpy())],
        )

    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_delete_sample_removes_object_and_row() -> None:
    uploader_id = uuid4()
    public_id = uuid4()
    video = pending_video(
        uploader_id=uploader_id,
        public_id=public_id,
        status="UPLOADED",
    )
    sample = VideoSampleImageUrl(
        id=77,
        fk_id=video.id,
        url=f"http://localhost:9000/streams/{public_id}/samples/sample_s_001.jpg",
        type="sample_s",
    )
    session = MediaSessionSpy(
        video=video,
        samples=[sample],
        sample_lookup=sample,
    )
    storage = StorageSpy()
    service = make_service(session, storage)

    result = await service.delete_sample(
        public_id=public_id,
        uploader_id=uploader_id,
        sample_id=77,
    )

    assert session.committed >= 1
    assert storage.delete_object_calls == [
        {
            "object_key": f"{public_id}/samples/sample_s_001.jpg",
            "bucket": "streams",
        },
    ]
    assert result.samples == []


@pytest.mark.asyncio
async def test_delete_sample_raises_not_found() -> None:
    uploader_id = uuid4()
    public_id = uuid4()
    video = pending_video(uploader_id=uploader_id, public_id=public_id)
    session = MediaSessionSpy(video=video, sample_lookup=None)
    service = make_service(session, StorageSpy())

    with pytest.raises(HTTPException) as exc_info:
        await service.delete_sample(
            public_id=public_id,
            uploader_id=uploader_id,
            sample_id=999,
        )

    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_upload_samples_uses_jp_infix_for_sample_l() -> None:
    uploader_id = uuid4()
    public_id = uuid4()
    video = pending_video(
        uploader_id=uploader_id,
        public_id=public_id,
        status="UPLOADED",
        cid="team00055",
    )
    session = MediaSessionSpy(video=video)
    storage = StorageSpy()
    service = make_service(session, storage)

    await service.upload_samples(
        public_id=public_id,
        uploader_id=uploader_id,
        image_type="sample_l",
        uploads=[cast(Any, UploadFileSpy(filename="still.png"))],
    )

    assert storage.upload_fileobj_calls[0]["object_key"].endswith(
        f"{public_id}/samples/team00055jp-1.png",
    )


@pytest.mark.asyncio
async def test_upload_samples_rejects_non_numeric_index_suffix() -> None:
    uploader_id = uuid4()
    public_id = uuid4()
    video = pending_video(
        uploader_id=uploader_id,
        public_id=public_id,
        cid="xyz00004",
        video_id="XYZ-004",
    )
    service = make_service(MediaSessionSpy(video=video), StorageSpy())

    with pytest.raises(HTTPException) as exc_info:
        await service.upload_samples(
            public_id=public_id,
            uploader_id=uploader_id,
            image_type="sample_s",
            uploads=[
                cast(
                    Any,
                    UploadFileSpy(filename="xyz00004-2x.jpg"),
                ),
            ],
        )

    assert exc_info.value.status_code == 400
    assert "positive integer" in str(exc_info.value.detail).lower()


@pytest.mark.asyncio
async def test_upload_samples_rejects_wrong_type_marker_for_sample_s() -> None:
    uploader_id = uuid4()
    public_id = uuid4()
    video = pending_video(
        uploader_id=uploader_id,
        public_id=public_id,
        cid="xyz00004",
    )
    service = make_service(MediaSessionSpy(video=video), StorageSpy())

    with pytest.raises(HTTPException) as exc_info:
        await service.upload_samples(
            public_id=public_id,
            uploader_id=uploader_id,
            image_type="sample_s",
            uploads=[
                cast(
                    Any,
                    UploadFileSpy(filename="xyz00004jp-1.jpg"),
                ),
            ],
        )

    assert exc_info.value.status_code == 400
    assert "type marker" in str(exc_info.value.detail).lower()


@pytest.mark.asyncio
async def test_upload_samples_accepts_matching_catalog_name() -> None:
    uploader_id = uuid4()
    public_id = uuid4()
    video = pending_video(
        uploader_id=uploader_id,
        public_id=public_id,
        cid="xyz004",
        video_id="XYZ-004",
    )
    session = MediaSessionSpy(video=video)
    storage = StorageSpy()
    service = make_service(session, storage)

    result = await service.upload_samples(
        public_id=public_id,
        uploader_id=uploader_id,
        image_type="sample_s",
        uploads=[
            cast(
                Any,
                UploadFileSpy(filename="xyz00004-1.jpg"),
            ),
        ],
    )

    assert len(result.samples) == 1
    assert storage.upload_fileobj_calls[0]["object_key"].endswith(
        f"{public_id}/samples/xyz004-1.jpg",
    )


@pytest.mark.asyncio
async def test_upload_thumbnail_rejects_wrong_type_marker() -> None:
    uploader_id = uuid4()
    public_id = uuid4()
    video = pending_video(
        uploader_id=uploader_id,
        public_id=public_id,
        cid="mird00150",
    )
    service = make_service(MediaSessionSpy(video=video), StorageSpy())

    with pytest.raises(HTTPException) as exc_info:
        await service.upload_thumbnail(
            public_id=public_id,
            uploader_id=uploader_id,
            image_type="large",
            upload=cast(
                Any,
                UploadFileSpy(filename="mird00150ps.jpg"),
            ),
        )

    assert exc_info.value.status_code == 400
    assert "type marker" in str(exc_info.value.detail).lower()


@pytest.mark.asyncio
async def test_upload_thumbnail_rejects_unknown_type_marker() -> None:
    uploader_id = uuid4()
    public_id = uuid4()
    video = pending_video(
        uploader_id=uploader_id,
        public_id=public_id,
        cid="xyz00004",
    )
    service = make_service(MediaSessionSpy(video=video), StorageSpy())

    with pytest.raises(HTTPException) as exc_info:
        await service.upload_thumbnail(
            public_id=public_id,
            uploader_id=uploader_id,
            image_type="list",
            upload=cast(
                Any,
                UploadFileSpy(filename="xyz00004mt.jpg"),
            ),
        )

    assert exc_info.value.status_code == 400
    assert "type marker" in str(exc_info.value.detail).lower()


@pytest.mark.asyncio
async def test_upload_thumbnail_accepts_zero_padded_code_variant() -> None:
    uploader_id = uuid4()
    public_id = uuid4()
    video = pending_video(
        uploader_id=uploader_id,
        public_id=public_id,
        cid="xyz004",
        video_id="XYZ-004",
    )
    session = MediaSessionSpy(video=video)
    storage = StorageSpy()
    service = make_service(session, storage)

    result = await service.upload_thumbnail(
        public_id=public_id,
        uploader_id=uploader_id,
        image_type="large",
        upload=cast(
            Any,
            UploadFileSpy(filename="xyz00004pl.jpg"),
        ),
    )

    assert storage.upload_fileobj_calls[0]["object_key"].endswith(
        f"{public_id}/thumbnails/xyz004pl.jpg",
    )
    assert len(result.thumbnails) == 1


@pytest.mark.asyncio
async def test_upload_thumbnail_rejects_unrelated_product_code() -> None:
    uploader_id = uuid4()
    public_id = uuid4()
    video = pending_video(
        uploader_id=uploader_id,
        public_id=public_id,
        cid="mird00150",
    )
    service = make_service(MediaSessionSpy(video=video), StorageSpy())

    with pytest.raises(HTTPException) as exc_info:
        await service.upload_thumbnail(
            public_id=public_id,
            uploader_id=uploader_id,
            image_type="large",
            upload=cast(
                Any,
                UploadFileSpy(filename="ssis00100pl.jpg"),
            ),
        )

    assert exc_info.value.status_code == 400
    assert "product code" in str(exc_info.value.detail).lower()


@pytest.mark.asyncio
async def test_upload_thumbnail_rejects_missing_catalog_cid() -> None:
    uploader_id = uuid4()
    public_id = uuid4()
    video = pending_video(
        uploader_id=uploader_id,
        public_id=public_id,
        cid=None,
        video_id="",
    )
    service = make_service(MediaSessionSpy(video=video), StorageSpy())

    with pytest.raises(HTTPException) as exc_info:
        await service.upload_thumbnail(
            public_id=public_id,
            uploader_id=uploader_id,
            image_type="list",
            upload=cast(Any, UploadFileSpy()),
        )

    assert exc_info.value.status_code == 400
    assert "cid" in str(exc_info.value.detail).lower()
