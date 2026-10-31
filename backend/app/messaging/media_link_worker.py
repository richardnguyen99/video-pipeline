"""Download external media URLs, normalize images, upload to streams."""

# pylint: disable=broad-exception-caught

from __future__ import annotations

import ipaddress
import logging
import re
import socket
from io import BytesIO
from typing import Any, Optional, cast
from urllib.parse import urlparse

import httpx
from PIL import Image
from sqlmodel import col, select

from app.database import async_session_factory
from app.models.video import Video, VideoImageUrl, VideoSampleImageUrl
from app.storage.client import get_object_storage_client

_logger = logging.getLogger("uvicorn.error")

_MAX_DOWNLOAD_BYTES = 12 * 1024 * 1024
_DOWNLOAD_TIMEOUT_S = 30.0
_ALLOWED_CONTENT_PREFIXES = (
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
)
_THUMBNAIL_SUFFIX = {"large": "pl", "list": "pt", "small": "ps"}
_SAMPLE_INFIX = {"sample_s": "", "sample_l": "jp"}
_CID_SAFE = re.compile(r"[^a-z0-9]+")


def _is_blocked_host(hostname: str) -> bool:
    try:
        infos = socket.getaddrinfo(hostname, None)
    except socket.gaierror:
        return True

    for info in infos:
        ip_str = info[4][0]

        try:
            ip = ipaddress.ip_address(ip_str)
        except ValueError:
            return True

        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
        ):
            return True

    return False


def _validate_source_url(url: str) -> str:
    cleaned = (url or "").strip()
    parsed = urlparse(cleaned)

    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("source URL must be absolute http(s)")

    if _is_blocked_host(parsed.hostname):
        raise ValueError("source host is not allowed")

    return cleaned


async def _download_image(url: str) -> tuple[bytes, str]:
    headers = {"User-Agent": "VelvetMediaIngest/1.0"}

    async with httpx.AsyncClient(
        follow_redirects=True,
        timeout=_DOWNLOAD_TIMEOUT_S,
        headers=headers,
    ) as client:
        async with client.stream("GET", url) as response:
            response.raise_for_status()
            content_type = (
                (response.headers.get("content-type") or "")
                .split(";")[0]
                .strip()
                .lower()
            )

            if not any(
                content_type.startswith(prefix)
                for prefix in _ALLOWED_CONTENT_PREFIXES
            ):
                raise ValueError(
                    f"unsupported content-type: {content_type or 'unknown'}"
                )

            chunks: list[bytes] = []
            total = 0

            async for chunk in response.aiter_bytes():
                total += len(chunk)

                if total > _MAX_DOWNLOAD_BYTES:
                    raise ValueError("image exceeds size limit")

                chunks.append(chunk)

            return b"".join(chunks), content_type


def _normalize_image(payload: bytes) -> tuple[bytes, str, str]:
    with Image.open(BytesIO(payload)) as opened:
        opened.load()
        rgb = opened.convert("RGB")
        buffer = BytesIO()
        rgb.save(buffer, format="JPEG", quality=90, optimize=True)

        return buffer.getvalue(), "image/jpeg", ".jpg"


def _catalog_cid(video: Video) -> str:
    raw = (video.cid or video.video_id or "").strip().lower()
    cleaned = _CID_SAFE.sub("", raw)

    if not cleaned:
        raise ValueError("video has no usable catalog id")

    return cleaned


def _thumbnail_basename(catalog_cid: str, image_type: str) -> str:
    suffix = _THUMBNAIL_SUFFIX.get(image_type, "pl")

    return f"{catalog_cid}{suffix}.jpg"


def _sample_basename(catalog_cid: str, image_type: str, index: int) -> str:
    infix = _SAMPLE_INFIX.get(image_type, "")

    return f"{catalog_cid}{infix}-{index}.jpg"


async def _load_media_row(
    session: Any,
    kind: str,
    image_id: int,
) -> Optional[VideoImageUrl | VideoSampleImageUrl]:
    if kind == "thumbnail":
        result = await session.execute(
            select(VideoImageUrl).where(col(VideoImageUrl.id) == image_id),
        )

        return cast(
            Optional[VideoImageUrl],
            result.scalar_one_or_none(),
        )

    result = await session.execute(
        select(VideoSampleImageUrl).where(
            col(VideoSampleImageUrl.id) == image_id
        ),
    )

    return cast(
        Optional[VideoSampleImageUrl],
        result.scalar_one_or_none(),
    )


async def _resolve_object_key(
    session: Any,
    *,
    kind: str,
    row: VideoImageUrl | VideoSampleImageUrl,
    video: Video,
    catalog_cid: str,
) -> str:
    image_type = (row.type or "").strip().lower()
    public_id = video.public_id

    if kind == "thumbnail":
        basename = _thumbnail_basename(catalog_cid, image_type)

        return f"{public_id}/thumbnails/{basename}"

    sample_result = await session.execute(
        select(VideoSampleImageUrl)
        .where(
            col(VideoSampleImageUrl.fk_id) == row.fk_id,
            col(VideoSampleImageUrl.type) == image_type,
            col(VideoSampleImageUrl.status) == "READY",
        )
        .order_by(col(VideoSampleImageUrl.id).asc()),
    )
    ready_count = len(list(sample_result.scalars().all()))
    basename = _sample_basename(catalog_cid, image_type, ready_count + 1)

    return f"{public_id}/samples/{basename}"


async def _ingest_external_image(
    session: Any,
    *,
    kind: str,
    image_id: int,
    row: VideoImageUrl | VideoSampleImageUrl,
    video: Video,
) -> None:
    storage = get_object_storage_client()
    source = row.source_url or ""
    row.status = "PROCESSING"
    row.error_message = None
    await session.commit()

    try:
        cleaned = _validate_source_url(source)
        raw, _content_type = await _download_image(cleaned)
        normalized, content_type, _extension = _normalize_image(raw)
        object_key = await _resolve_object_key(
            session,
            kind=kind,
            row=row,
            video=video,
            catalog_cid=_catalog_cid(video),
        )
        uploaded_url = await storage.upload_fileobj(
            object_key=object_key,
            fileobj=BytesIO(normalized),
            content_type=content_type,
            bucket=storage.streams_bucket,
        )
        row.url = uploaded_url
        row.status = "READY"
        row.error_message = None
        await session.commit()
        _logger.info(
            "media link ready kind=%s id=%s key=%s",
            kind,
            image_id,
            object_key,
        )
    except Exception as exc:
        row.status = "FAILED"
        row.error_message = str(exc)[:2000]
        await session.commit()
        _logger.warning(
            "media link failed kind=%s id=%s detail=%s",
            kind,
            image_id,
            str(exc)[:500],
        )


async def process_media_link_message(payload: dict[str, Any]) -> None:
    """Ingest one external media URL into streams and mark the row READY."""

    kind = str(payload.get("kind") or "").strip().lower()
    image_id_raw = payload.get("image_id")

    if kind not in {"thumbnail", "sample"} or image_id_raw is None:
        _logger.warning("media link payload invalid payload=%s", payload)

        return

    image_id = int(image_id_raw)

    async with async_session_factory() as session:
        row = await _load_media_row(session, kind, image_id)

        if row is None:
            _logger.warning(
                "media link row missing kind=%s id=%s", kind, image_id
            )

            return

        if (row.status or "").upper() == "READY" and not (
            row.url or ""
        ).startswith(
            "pending://",
        ):
            return

        video_result = await session.execute(
            select(Video).where(col(Video.id) == row.fk_id),
        )
        video = video_result.scalar_one_or_none()

        if video is None or video.public_id is None:
            row.status = "FAILED"
            row.error_message = "video missing public_id"
            await session.commit()

            return

        await _ingest_external_image(
            session,
            kind=kind,
            image_id=image_id,
            row=row,
            video=video,
        )
