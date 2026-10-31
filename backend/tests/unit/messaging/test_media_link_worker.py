"""Unit tests for media-link worker helpers (external image ingest)."""

from __future__ import annotations

from io import BytesIO
from typing import Any
from uuid import uuid4

import pytest
from PIL import Image

from app.messaging.media_link_worker import (
    _normalize_image,
    _sample_basename,
    _thumbnail_basename,
    _validate_source_url,
)


def test_validate_source_url_accepts_public_https() -> None:
    cleaned = _validate_source_url("  https://cdn.example.com/a/b.jpg  ")

    assert cleaned == "https://cdn.example.com/a/b.jpg"


def test_validate_source_url_rejects_relative() -> None:
    with pytest.raises(ValueError, match="absolute"):
        _validate_source_url("/local/path.jpg")


def test_validate_source_url_rejects_non_http_scheme() -> None:
    with pytest.raises(ValueError, match="absolute"):
        _validate_source_url("ftp://files.example.com/a.jpg")


def test_validate_source_url_rejects_loopback_host() -> None:
    with pytest.raises(ValueError, match="not allowed"):
        _validate_source_url("http://127.0.0.1:9000/temp/pl.jpg")


def test_validate_source_url_rejects_private_host() -> None:
    with pytest.raises(ValueError, match="not allowed"):
        _validate_source_url("http://10.0.0.157:9000/temp/xyz00007pl.jpg")


def test_validate_source_url_rejects_localhost_name() -> None:
    with pytest.raises(ValueError, match="not allowed"):
        _validate_source_url("http://localhost:9000/streams/pl.jpg")


def test_normalize_image_converts_to_jpeg() -> None:
    buffer = BytesIO()
    Image.new("RGBA", (8, 8), (255, 0, 0, 128)).save(buffer, format="PNG")
    payload = buffer.getvalue()

    body, content_type, extension = _normalize_image(payload)

    assert content_type == "image/jpeg"
    assert extension == ".jpg"
    assert body[:2] == b"\xff\xd8"


def test_thumbnail_basename_uses_catalog_suffix() -> None:
    assert _thumbnail_basename("team00055", "large") == "team00055pl.jpg"
    assert _thumbnail_basename("team00055", "list") == "team00055pt.jpg"
    assert _thumbnail_basename("team00055", "small") == "team00055ps.jpg"


def test_sample_basename_uses_index() -> None:
    assert _sample_basename("team00055", "sample_s", 1) == "team00055-1.jpg"
    assert _sample_basename("team00055", "sample_l", 2) == "team00055jp-2.jpg"


@pytest.mark.asyncio
async def test_process_media_link_marks_failed_on_blocked_host(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.messaging import media_link_worker as worker
    from app.models.video import Video, VideoImageUrl

    row = VideoImageUrl(
        id=11,
        fk_id=42,
        url="pending://token",
        type="large",
        status="PENDING",
        source_url="http://10.0.0.1/pl.jpg",
        error_message=None,
    )
    video = Video(
        id=42,
        video_id="upl-test",
        title="clip",
        cid="team00055",
        origin="upload",
        public_id=uuid4(),
        status="UPLOADED",
    )
    commits: list[str] = []

    class _Result:
        def __init__(self, value: Any) -> None:
            self._value = value

        def scalar_one_or_none(self) -> Any:
            return self._value

    class _Session:
        async def execute(self, statement: Any) -> _Result:
            text = str(statement).lower()

            if "videoimageurl" in text or "video_image_url" in text:
                return _Result(row)

            return _Result(video)

        async def commit(self) -> None:
            commits.append(row.status or "")

        async def __aenter__(self) -> _Session:
            return self

        async def __aexit__(self, *_args: object) -> None:
            return None

    class _SessionFactory:
        def __call__(self) -> _Session:
            return _Session()

    monkeypatch.setattr(worker, "async_session_factory", _SessionFactory())
    monkeypatch.setattr(worker, "get_object_storage_client", lambda: object())

    await worker.process_media_link_message(
        {
            "kind": "thumbnail",
            "image_id": 11,
            "public_id": str(video.public_id),
        },
    )

    assert row.status == "FAILED"
    assert row.error_message is not None
    assert "not allowed" in row.error_message
    assert "FAILED" in commits


@pytest.mark.asyncio
async def test_process_media_link_uploads_on_success(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.messaging import media_link_worker as worker
    from app.models.video import Video, VideoImageUrl

    public_id = uuid4()
    row = VideoImageUrl(
        id=22,
        fk_id=99,
        url="pending://token",
        type="large",
        status="PENDING",
        source_url="https://cdn.example.com/pl.jpg",
        error_message=None,
    )
    video = Video(
        id=99,
        video_id="upl-test",
        title="clip",
        cid="team00055",
        origin="upload",
        public_id=public_id,
        status="UPLOADED",
    )

    class _Result:
        def __init__(self, value: Any) -> None:
            self._value = value

        def scalar_one_or_none(self) -> Any:
            return self._value

        def scalars(self) -> Any:
            return self

        def all(self) -> list[Any]:
            return []

    class _Session:
        async def execute(self, statement: Any) -> _Result:
            text = str(statement).lower()

            if "videoimageurl" in text or "video_image_url" in text:
                return _Result(row)

            return _Result(video)

        async def commit(self) -> None:
            return None

        async def __aenter__(self) -> _Session:
            return self

        async def __aexit__(self, *_args: object) -> None:
            return None

    class _SessionFactory:
        def __call__(self) -> _Session:
            return _Session()

    class _Storage:
        streams_bucket = "streams"
        upload_calls: list[dict[str, object]] = []

        async def upload_fileobj(
            self,
            *,
            object_key: str,
            fileobj: Any,
            content_type: str | None = None,
            bucket: str | None = None,
        ) -> str:
            body = fileobj.read()
            self.upload_calls.append(
                {
                    "object_key": object_key,
                    "content_type": content_type,
                    "bucket": bucket,
                    "size": len(body),
                },
            )

            return f"http://localhost:9000/streams/{object_key}"

    storage = _Storage()
    png = BytesIO()
    Image.new("RGB", (4, 4), (0, 128, 255)).save(png, format="PNG")

    async def _fake_download(_url: str) -> tuple[bytes, str]:
        return png.getvalue(), "image/png"

    monkeypatch.setattr(worker, "async_session_factory", _SessionFactory())
    monkeypatch.setattr(worker, "get_object_storage_client", lambda: storage)
    monkeypatch.setattr(
        worker, "_validate_source_url", lambda url: url.strip()
    )
    monkeypatch.setattr(worker, "_download_image", _fake_download)

    await worker.process_media_link_message(
        {
            "kind": "thumbnail",
            "image_id": 22,
            "public_id": str(public_id),
        },
    )

    assert row.status == "READY"
    assert row.error_message is None
    assert row.url.endswith(f"{public_id}/thumbnails/team00055pl.jpg")
    assert len(storage.upload_calls) == 1
    assert storage.upload_calls[0]["bucket"] == "streams"
    assert storage.upload_calls[0]["content_type"] == "image/jpeg"
