"""Probe, encode HLS ladder, package master playlist (pipeline steps 4-6)."""

# pylint: disable=broad-exception-caught, too-many-lines

from __future__ import annotations

import logging
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Coroutine, Optional

from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import settings
from app.database import async_session_factory
from app.messaging.transcode_job import (
    refresh_job_lock,
    release_job_lock,
    try_acquire_job_lock,
)
from app.messaging.transcode_pool import get_transcode_semaphore
from app.messaging.transcode_progress import (
    RungProgressSnapshot,
    write_progress,
)
from app.models.video import Video, VideoM3u8, VideoRendition
from app.storage.client import ObjectStorageClient, get_object_storage_client
from app.utils.hls_encode import (
    build_master_playlist,
    encode_hls_rendition,
)
from app.utils.media_probe import (
    MediaProbeResult,
    plan_rendition_ladder,
    probe_media,
)

_logger = logging.getLogger("uvicorn.error")

_STATUS_UPLOADED = "UPLOADED"
_STATUS_PROBING = "PROBING"
_STATUS_QUEUED = "QUEUED"
_STATUS_ENCODING = "ENCODING"
_STATUS_PACKAGING = "PACKAGING"
_STATUS_READY = "READY"
_STATUS_FAILED = "FAILED"

_RENDITION_PENDING = "PENDING"
_RENDITION_ENCODING = "ENCODING"
_RENDITION_READY = "READY"
_RENDITION_FAILED = "FAILED"

_HLS_CONTENT_TYPES = {
    ".m3u8": "application/vnd.apple.mpegurl",
    ".ts": "video/mp2t",
}

_MAX_RENDITION_ATTEMPTS = 3

_AUDIO_KBPS_BY_HEIGHT = {
    240: 64,
    360: 96,
    480: 128,
    720: 128,
    1080: 128,
}

# ENCODING/PACKAGING included so a crashed worker can resume incomplete ladders.
_ELIGIBLE_STATUSES = frozenset(
    {
        _STATUS_UPLOADED,
        _STATUS_PROBING,
        _STATUS_QUEUED,
        _STATUS_ENCODING,
        _STATUS_PACKAGING,
        _STATUS_FAILED,
    },
)

ReadySpec = tuple[str, int, int, int]


def _parse_uuid(value: object) -> Optional[uuid.UUID]:
    if value is None:
        return None

    try:
        return uuid.UUID(str(value))
    except ValueError, TypeError:
        return None


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _spec_from_rendition(row: VideoRendition) -> ReadySpec:
    return (row.label, row.width, row.height, row.video_kbps)


def _rung_snapshot(row: VideoRendition) -> RungProgressSnapshot:
    return RungProgressSnapshot(
        label=row.label,
        width=row.width,
        height=row.height,
        video_kbps=row.video_kbps,
        status=row.status or _RENDITION_PENDING,
        progress_pct=int(row.progress_pct or 0),
        segment_count=row.segment_count,
        playlist_key=row.playlist_key,
    )


def _sync_rung_in_list(
    rungs: list[RungProgressSnapshot],
    row: VideoRendition,
) -> None:
    snap = _rung_snapshot(row)

    for index, existing in enumerate(rungs):
        if existing.label == snap.label:
            rungs[index] = snap

            return

    rungs.append(snap)


async def _mark_failed(
    session: AsyncSession,
    video: Video,
    public_id: uuid.UUID,
    *,
    code: str,
    message: str,
) -> None:
    video.status = _STATUS_FAILED
    video.error_code = code
    video.error_message = message[:2000]
    await session.commit()
    await write_progress(
        public_id,
        status=_STATUS_FAILED,
        overall_pct=0.0,
        message=message[:500],
    )


async def _load_video(
    session: AsyncSession,
    public_id: uuid.UUID,
) -> Optional[Video]:
    result = await session.execute(
        select(Video).where(Video.public_id == public_id),
    )

    return result.scalar_one_or_none()


async def _apply_probe_to_video(video: Video, probe: MediaProbeResult) -> None:
    if video.duration is None and probe.duration_s is not None:
        video.duration = probe.duration_s

    if probe.width is not None:
        video.width = probe.width

    if probe.height is not None:
        video.height = probe.height

    if probe.fps is not None:
        video.fps = probe.fps

    if probe.video_codec:
        video.video_codec = probe.video_codec[:50]

    if probe.audio_codec:
        video.audio_codec = probe.audio_codec[:50]


async def _ensure_rendition_rows(
    session: AsyncSession,
    *,
    video_db_id: int,
    height: int,
    width: int,
) -> None:
    if height <= 0 or width <= 0:
        return

    existing = await session.execute(
        select(VideoRendition).where(VideoRendition.video_id == video_db_id),
    )
    have = {row.label for row in existing.scalars().all()}

    for label, rw, rh, v_kbps, _a_kbps in plan_rendition_ladder(
        source_height=height,
        source_width=width,
    ):
        if label in have:
            continue

        session.add(
            VideoRendition(
                video_id=video_db_id,
                label=label,
                width=rw,
                height=rh,
                video_kbps=v_kbps,
                status=_RENDITION_PENDING,
                progress_pct=0,
                attempt=0,
            ),
        )


async def _load_renditions(
    session: AsyncSession,
    video_db_id: int,
) -> list[VideoRendition]:
    result = await session.execute(
        select(VideoRendition)
        .where(VideoRendition.video_id == video_db_id)
        .order_by(col(VideoRendition.height).asc()),
    )

    return list(result.scalars().all())


async def _probe_and_plan(
    session: AsyncSession,
    storage: ObjectStorageClient,
    video: Video,
    public_id: uuid.UUID,
) -> Optional[float]:
    """Probe source, fill video columns, plan rendition rows.

    Returns duration in seconds, or None when the job should stop.
    """

    source_key = video.source_key
    assert source_key is not None

    duration_hint = float(video.duration) if video.duration else None
    video_db_id = video.id

    video.status = _STATUS_PROBING
    video.error_code = None
    video.error_message = None
    await session.commit()
    await session.refresh(video)
    await write_progress(public_id, status=_STATUS_PROBING, overall_pct=0.0)

    try:
        source_url = await storage.generate_presigned_get_url(
            object_key=source_key
        )
        probe = await probe_media(source_url)
    except Exception as exc:
        _logger.exception("transcode probe failed public_id=%s", public_id)
        await _mark_failed(
            session,
            video,
            public_id,
            code="PROBE_FAILED",
            message=str(exc),
        )

        return None

    if not probe.has_video:
        await _mark_failed(
            session,
            video,
            public_id,
            code="PROBE_NO_VIDEO",
            message="Source has no video stream.",
        )

        return None

    await session.refresh(video)
    await _apply_probe_to_video(video, probe)
    await _ensure_rendition_rows(
        session,
        video_db_id=video_db_id,
        height=probe.height or 0,
        width=probe.width or 0,
    )

    video.status = _STATUS_QUEUED
    await session.commit()
    await session.refresh(video)
    await write_progress(public_id, status=_STATUS_QUEUED, overall_pct=5.0)

    _logger.info(
        "transcode probed public_id=%s %sx%s codec=%s/%s duration=%s",
        public_id,
        video.width,
        video.height,
        video.video_codec,
        video.audio_codec,
        video.duration,
    )

    if probe.duration_s is not None:
        return float(probe.duration_s)

    return duration_hint


async def _handle_encode_error(
    session: AsyncSession,
    video: Video,
    public_id: uuid.UUID,
    exc: Exception,
) -> None:
    _logger.exception("transcode encode failed public_id=%s", public_id)

    if video.status != _STATUS_READY:
        await _mark_failed(
            session,
            video,
            public_id,
            code="ENCODE_FAILED",
            message=str(exc),
        )
    else:
        video.error_code = "ENCODE_PARTIAL"
        video.error_message = str(exc)[:2000]
        await session.commit()
        await write_progress(
            public_id,
            status=_STATUS_READY,
            overall_pct=100.0,
            message="playable; higher rungs failed",
        )

    _logger.error(
        "transcode reported encode error public_id=%s status=%s detail=%s",
        public_id,
        video.status,
        str(exc)[:500],
    )


async def _run_locked_pipeline(
    session: AsyncSession,
    storage: ObjectStorageClient,
    video: Video,
    public_id: uuid.UUID,
) -> None:
    """Probe, encode, and package while the job lock is held."""

    get_transcode_semaphore()
    _logger.info(
        "transcode: start public_id=%s status=%s source_key=%s max_ffmpeg=%s chunk_s=%s",
        public_id,
        video.status,
        video.source_key,
        settings.transcode_max_ffmpeg,
        settings.transcode_chunk_seconds,
    )

    video_db_id = video.id
    source_key = video.source_key
    assert source_key is not None

    existing_renditions = await _load_renditions(session, video_db_id)
    can_skip_probe = (
        video.status in {_STATUS_ENCODING, _STATUS_QUEUED, _STATUS_PACKAGING}
        and video.duration is not None
        and bool(existing_renditions)
    )

    if can_skip_probe:
        duration_s = float(video.duration) if video.duration else None
        _logger.info(
            "transcode: resume incomplete ladder public_id=%s rungs=%s",
            public_id,
            len(existing_renditions),
        )
    else:
        duration_s = await _probe_and_plan(session, storage, video, public_id)

        if duration_s is None and video.status == _STATUS_FAILED:
            return

        existing_renditions = await _load_renditions(session, video_db_id)

    video.status = _STATUS_ENCODING
    await session.commit()
    await session.refresh(video)

    renditions = existing_renditions
    live_rungs = [
        _rung_snapshot(row)
        for row in sorted(renditions, key=lambda r: r.height)
    ]
    await write_progress(
        public_id,
        status=_STATUS_ENCODING,
        overall_pct=8.0,
        message="Encoding ladder",
        rungs=live_rungs,
    )

    if not renditions:
        await _mark_failed(
            session,
            video,
            public_id,
            code="ENCODE_NO_LADDER",
            message="No rendition ladder could be planned.",
        )

        return

    try:
        source_url = await storage.generate_presigned_get_url(
            object_key=source_key,
            expires_in=14_400,
        )
        ready_specs = await _encode_progressive_ladder(
            session=session,
            storage=storage,
            video=video,
            video_db_id=video_db_id,
            public_id=public_id,
            source_url=source_url,
            duration_s=duration_s,
            renditions=renditions,
            live_rungs=live_rungs,
        )
    except Exception as exc:
        await _handle_encode_error(session, video, public_id, exc)

        return

    if not ready_specs:
        await _mark_failed(
            session,
            video,
            public_id,
            code="ENCODE_EMPTY",
            message="No rendition finished successfully.",
        )

        return

    if video.ready_at is None:
        video.ready_at = _utcnow()

    video.status = _STATUS_READY
    video.error_code = None
    video.error_message = None
    await session.commit()
    await session.refresh(video)
    await write_progress(
        public_id,
        status=_STATUS_READY,
        overall_pct=100.0,
        message="Ladder complete",
        rungs=live_rungs,
    )
    _logger.info(
        "transcode ladder complete public_id=%s renditions=%s",
        public_id,
        len(ready_specs),
    )


async def process_transcode_message(payload: dict[str, Any]) -> None:
    """Probe source, encode HLS ladder, package master playlist.

    Expected payload::

        {"public_id": "<uuid>", "video_id": <int optional>}
    """

    public_id = _parse_uuid(payload.get("public_id"))

    if public_id is None:
        _logger.warning("transcode message missing public_id: %s", payload)

        return

    storage = get_object_storage_client()

    async with async_session_factory() as session:
        video = await _load_video(session, public_id)

        if video is None:
            _logger.warning(
                "transcode: video not found public_id=%s", public_id
            )

            return

        if not video.source_key:
            await _mark_failed(
                session,
                video,
                public_id,
                code="PROBE_NO_SOURCE",
                message="Upload has no source key.",
            )

            return

        if video.status not in _ELIGIBLE_STATUSES:
            _logger.info(
                "transcode: skip public_id=%s status=%s",
                public_id,
                video.status,
            )

            return

        if video.status == _STATUS_READY:
            renditions = await _load_renditions(session, video.id)
            _, pending = _split_pending(renditions)

            if not pending:
                _logger.info(
                    "transcode: skip public_id=%s (already READY)",
                    public_id,
                )

                return

        if not await try_acquire_job_lock(public_id):
            _logger.info(
                "transcode: skip public_id=%s (job lock held by another runner)",
                public_id,
            )

            return

        try:
            await _run_locked_pipeline(session, storage, video, public_id)
        finally:
            await release_job_lock(public_id)


def _split_pending(
    renditions: list[VideoRendition],
) -> tuple[list[ReadySpec], list[VideoRendition]]:
    ready_specs: list[ReadySpec] = []
    pending: list[VideoRendition] = []

    for rendition in sorted(renditions, key=lambda row: row.height):
        if rendition.status == _RENDITION_READY and rendition.playlist_key:
            ready_specs.append(_spec_from_rendition(rendition))
            continue

        pending.append(rendition)

    return ready_specs, pending


async def _encode_progressive_ladder(
    *,
    session: AsyncSession,
    storage: ObjectStorageClient,
    video: Video,
    video_db_id: int,
    public_id: uuid.UUID,
    source_url: str,
    duration_s: Optional[float],
    renditions: list[VideoRendition],
    live_rungs: list[RungProgressSnapshot],
) -> list[ReadySpec]:
    """Encode lowest rungs first; publish a playable master as soon as possible."""

    ready_specs, pending = _split_pending(renditions)

    if not pending:
        if ready_specs:
            await _publish_playable(
                session=session,
                storage=storage,
                video=video,
                video_db_id=video_db_id,
                public_id=public_id,
                ready_specs=ready_specs,
            )

        return ready_specs

    total = len(pending) + len(ready_specs)
    done = len(ready_specs)

    with tempfile.TemporaryDirectory(prefix="hls-") as tmp:
        tmp_root = Path(tmp)
        first = pending[0]
        rest = pending[1:]

        await _encode_and_upload_one(
            session=session,
            storage=storage,
            public_id=public_id,
            source_url=source_url,
            duration_s=duration_s,
            rendition=first,
            work_dir=tmp_root / first.label,
            progress_base=8.0,
            progress_span=max(12.0, 85.0 / max(total, 1)),
            label=f"first:{first.label}",
            live_rungs=live_rungs,
        )
        ready_specs.append(_spec_from_rendition(first))
        done += 1

        master_url = await _publish_playable(
            session=session,
            storage=storage,
            video=video,
            video_db_id=video_db_id,
            public_id=public_id,
            ready_specs=ready_specs,
        )
        _logger.info(
            "transcode early-ready public_id=%s first_rung=%s m3u8=%s",
            public_id,
            first.label,
            master_url,
        )

        await _encode_higher_rungs(
            session=session,
            storage=storage,
            video=video,
            video_db_id=video_db_id,
            public_id=public_id,
            rest=rest,
            ready_specs=ready_specs,
            tmp_root=tmp_root,
            duration_s=duration_s,
            done=done,
            total=total,
            live_rungs=live_rungs,
        )

    return ready_specs


async def _encode_higher_rungs(
    *,
    session: AsyncSession,
    storage: ObjectStorageClient,
    video: Video,
    video_db_id: int,
    public_id: uuid.UUID,
    rest: list[VideoRendition],
    ready_specs: list[ReadySpec],
    tmp_root: Path,
    duration_s: Optional[float],
    done: int,
    total: int,
    live_rungs: list[RungProgressSnapshot],
) -> None:
    if not rest:
        return

    source_key = video.source_key or ""

    for index, row in enumerate(rest):
        if (
            row.attempt or 0
        ) >= _MAX_RENDITION_ATTEMPTS and row.status == _RENDITION_FAILED:
            _logger.warning(
                "transcode: skip exhausted rung public_id=%s label=%s attempts=%s",
                public_id,
                row.label,
                row.attempt,
            )

            continue

        rung_source_url = await storage.generate_presigned_get_url(
            object_key=source_key,
            expires_in=14_400,
        )
        progress_base = 8.0 + ((done + index) / max(total, 1)) * 85.0
        progress_span = 85.0 / max(total, 1)

        try:
            await _encode_and_upload_one(
                session=session,
                storage=storage,
                public_id=public_id,
                source_url=rung_source_url,
                duration_s=duration_s,
                rendition=row,
                work_dir=tmp_root / row.label,
                progress_base=progress_base,
                progress_span=progress_span,
                label=f"upgrade:{row.label}",
                live_rungs=live_rungs,
            )
        except Exception as exc:
            detail = str(exc)[:2000]
            _logger.error(
                "higher-rung encode failed public_id=%s label=%s attempts=%s "
                "detail=%s (continuing remaining rungs)",
                public_id,
                row.label,
                row.attempt,
                detail[:500],
            )

            continue

        ready_specs.append(_spec_from_rendition(row))
        await _publish_playable(
            session=session,
            storage=storage,
            video=video,
            video_db_id=video_db_id,
            public_id=public_id,
            ready_specs=ready_specs,
        )
        _logger.info(
            "transcode ladder upgraded public_id=%s rungs=%s",
            public_id,
            [spec[0] for spec in ready_specs],
        )


def _clear_work_dir(work_dir: Path) -> None:
    if work_dir.exists():
        for leftover in work_dir.glob("*"):
            if leftover.is_file():
                leftover.unlink(missing_ok=True)

    work_dir.mkdir(parents=True, exist_ok=True)


async def _mark_rendition_state(
    *,
    session: AsyncSession,
    public_id: uuid.UUID,
    rendition: VideoRendition,
    live_rungs: list[RungProgressSnapshot],
    status_value: str,
    progress_pct: int,
    overall_pct: float,
    message: str,
    playlist_key: Optional[str] = None,
    segment_count: Optional[int] = None,
) -> None:
    rendition.status = status_value
    rendition.progress_pct = progress_pct

    if playlist_key is not None:
        rendition.playlist_key = playlist_key

    if segment_count is not None:
        rendition.segment_count = segment_count

    await session.commit()
    _sync_rung_in_list(live_rungs, rendition)
    await write_progress(
        public_id,
        status=_STATUS_ENCODING,
        overall_pct=overall_pct,
        message=message,
        rungs=live_rungs,
    )
    await refresh_job_lock(public_id)


async def _upload_and_verify_hls(
    storage: ObjectStorageClient,
    *,
    public_id: uuid.UUID,
    label: str,
    work_dir: Path,
) -> tuple[str, int]:
    """Upload local HLS output and require playlist.m3u8 in streams bucket."""

    key_prefix = f"{public_id}/{label}"
    playlist_key = f"{key_prefix}/playlist.m3u8"
    uploaded = await storage.upload_directory(
        local_dir=work_dir,
        key_prefix=key_prefix,
        bucket=storage.streams_bucket,
        content_type_map=_HLS_CONTENT_TYPES,
    )

    if not uploaded:
        raise RuntimeError(f"no HLS objects uploaded for {label}")

    playlist_exists = await storage.object_exists(
        playlist_key,
        bucket=storage.streams_bucket,
    )

    if not playlist_exists:
        raise RuntimeError(f"playlist missing after upload: {playlist_key}")

    segment_count = len(list(work_dir.glob("seg_*.ts")))

    return playlist_key, segment_count


def _make_rung_progress_callback(
    *,
    public_id: uuid.UUID,
    rendition: VideoRendition,
    work_dir: Path,
    progress_base: float,
    progress_span: float,
    label: str,
    live_rungs: list[RungProgressSnapshot],
) -> Callable[[float], Coroutine[Any, Any, None]]:
    last_published_pct = -1

    async def on_progress(pct: float) -> None:
        nonlocal last_published_pct

        rounded = int(pct)
        rendition.progress_pct = rounded

        if work_dir.is_dir():
            rendition.segment_count = len(list(work_dir.glob("seg_*.ts")))

        if rounded - last_published_pct < 2 and rounded < 100:
            return

        last_published_pct = rounded
        _sync_rung_in_list(live_rungs, rendition)
        await write_progress(
            public_id,
            status=_STATUS_ENCODING,
            overall_pct=progress_base + (pct / 100.0) * progress_span,
            message=f"{label} {rounded}%",
            rungs=live_rungs,
        )
        await refresh_job_lock(public_id)

    return on_progress


async def _encode_and_upload_one(
    *,
    session: AsyncSession,
    storage: ObjectStorageClient,
    public_id: uuid.UUID,
    source_url: str,
    duration_s: Optional[float],
    rendition: VideoRendition,
    work_dir: Path,
    progress_base: float,
    progress_span: float,
    label: str,
    live_rungs: list[RungProgressSnapshot],
) -> None:
    """Encode a single rung, upload to streams, mark rendition READY."""

    last_error: Optional[Exception] = None

    while True:
        current_attempt = (rendition.attempt or 0) + 1

        if current_attempt > _MAX_RENDITION_ATTEMPTS:
            await _mark_rendition_state(
                session=session,
                public_id=public_id,
                rendition=rendition,
                live_rungs=live_rungs,
                status_value=_RENDITION_FAILED,
                progress_pct=0,
                overall_pct=progress_base,
                message=f"{label} failed after {_MAX_RENDITION_ATTEMPTS} attempts",
            )

            raise RuntimeError(
                f"Rendition {rendition.label} failed after "
                f"{_MAX_RENDITION_ATTEMPTS} attempts: "
                f"{last_error if last_error is not None else 'max attempts exceeded'}",
            )

        rendition.attempt = current_attempt
        rendition.segment_count = 0
        await _mark_rendition_state(
            session=session,
            public_id=public_id,
            rendition=rendition,
            live_rungs=live_rungs,
            status_value=_RENDITION_ENCODING,
            progress_pct=0,
            overall_pct=progress_base,
            message=f"{label} started (attempt {current_attempt})",
        )

        on_progress = _make_rung_progress_callback(
            public_id=public_id,
            rendition=rendition,
            work_dir=work_dir,
            progress_base=progress_base,
            progress_span=progress_span,
            label=label,
            live_rungs=live_rungs,
        )
        _clear_work_dir(work_dir)

        try:
            await encode_hls_rendition(
                source=source_url,
                out_dir=work_dir,
                height=rendition.height,
                video_kbps=rendition.video_kbps,
                audio_kbps=_AUDIO_KBPS_BY_HEIGHT.get(rendition.height, 128),
                duration_s=duration_s,
                on_progress=on_progress,
            )
            playlist_key, segment_count = await _upload_and_verify_hls(
                storage,
                public_id=public_id,
                label=rendition.label,
                work_dir=work_dir,
            )
            await _mark_rendition_state(
                session=session,
                public_id=public_id,
                rendition=rendition,
                live_rungs=live_rungs,
                status_value=_RENDITION_READY,
                progress_pct=100,
                overall_pct=progress_base + progress_span,
                message=f"{label} ready",
                playlist_key=playlist_key,
                segment_count=segment_count,
            )

            return
        except Exception as exc:
            last_error = exc
            await _mark_rendition_state(
                session=session,
                public_id=public_id,
                rendition=rendition,
                live_rungs=live_rungs,
                status_value=_RENDITION_FAILED,
                progress_pct=0,
                overall_pct=progress_base,
                message=f"{label} failed (attempt {current_attempt})",
            )
            _logger.warning(
                "transcode rung attempt failed public_id=%s label=%s "
                "attempt=%s/%s detail=%s",
                public_id,
                rendition.label,
                current_attempt,
                _MAX_RENDITION_ATTEMPTS,
                str(exc)[:500],
            )


async def _ensure_m3u8_row(
    session: AsyncSession,
    *,
    video_db_id: int,
    master_url: str,
) -> None:
    existing = await session.execute(
        select(VideoM3u8).where(
            VideoM3u8.fk_id == video_db_id,
            VideoM3u8.m3u8_url == master_url,
        ),
    )

    if existing.scalar_one_or_none() is None:
        session.add(
            VideoM3u8(
                fk_id=video_db_id,
                m3u8_url=master_url,
            ),
        )


async def _demote_missing_playlists(
    *,
    session: AsyncSession,
    storage: ObjectStorageClient,
    public_id: uuid.UUID,
    video_db_id: int,
    ready_specs: list[ReadySpec],
) -> list[ReadySpec]:
    """Keep only rungs whose playlist object exists; demote the rest in DB."""

    verified = await _filter_ready_specs_with_objects(
        storage,
        public_id,
        ready_specs,
    )
    verified_labels = {spec[0] for spec in verified}
    missing_labels = [
        spec[0] for spec in ready_specs if spec[0] not in verified_labels
    ]

    if not missing_labels:
        return verified

    renditions = await _load_renditions(session, video_db_id)

    for row in renditions:
        if row.label not in missing_labels:
            continue

        row.status = _RENDITION_FAILED
        row.progress_pct = 0
        row.playlist_key = None
        row.segment_count = 0
        _logger.warning(
            "demote rung missing playlist public_id=%s label=%s",
            public_id,
            row.label,
        )

    await session.commit()

    return verified


async def _publish_playable(
    *,
    session: AsyncSession,
    storage: ObjectStorageClient,
    video: Video,
    video_db_id: int,
    public_id: uuid.UUID,
    ready_specs: list[ReadySpec],
) -> str:
    """Write master playlist for currently ready rungs.

    Does not mark the video READY — that happens only after the full ladder
    finishes so list/status UIs do not show Done while higher rungs encode.
    """

    verified = await _demote_missing_playlists(
        session=session,
        storage=storage,
        public_id=public_id,
        video_db_id=video_db_id,
        ready_specs=ready_specs,
    )

    if not verified:
        raise RuntimeError(
            f"no playable rungs with playlists for public_id={public_id}",
        )

    master_url = await _package_master(
        storage=storage,
        public_id=public_id,
        ready_specs=verified,
    )

    await _ensure_m3u8_row(
        session,
        video_db_id=video_db_id,
        master_url=master_url,
    )

    if video.status != _STATUS_ENCODING:
        video.status = _STATUS_ENCODING

    video.error_code = None
    video.error_message = None
    await session.commit()
    await session.refresh(video)
    await write_progress(
        public_id,
        status=_STATUS_ENCODING,
        overall_pct=min(95.0, 20.0 + 15.0 * len(verified)),
        message=f"playable ({len(verified)} rung(s))",
    )

    return master_url


async def _filter_ready_specs_with_objects(
    storage: ObjectStorageClient,
    public_id: uuid.UUID,
    ready_specs: list[ReadySpec],
) -> list[ReadySpec]:
    """Drop rungs whose media playlist is missing from the streams bucket."""

    kept: list[ReadySpec] = []

    for spec in ready_specs:
        label = spec[0]
        playlist_key = f"{public_id}/{label}/playlist.m3u8"
        exists = await storage.object_exists(
            playlist_key,
            bucket=storage.streams_bucket,
        )

        if exists:
            kept.append(spec)
            continue

        _logger.warning(
            "master package: skip missing playlist public_id=%s key=%s",
            public_id,
            playlist_key,
        )

    return kept


async def _package_master(
    *,
    storage: ObjectStorageClient,
    public_id: uuid.UUID,
    ready_specs: list[ReadySpec],
) -> str:
    """Write and upload master index.m3u8; return its public URL."""

    verified = await _filter_ready_specs_with_objects(
        storage,
        public_id,
        ready_specs,
    )

    if not verified:
        raise RuntimeError(
            f"no playable rungs with playlists for public_id={public_id}",
        )

    body = build_master_playlist(verified)

    with tempfile.TemporaryDirectory(prefix="hls-master-") as tmp:
        master_path = Path(tmp) / "index.m3u8"
        master_path.write_text(body, encoding="utf-8")
        object_key = f"{public_id}/index.m3u8"

        return await storage.upload_file(
            object_key=object_key,
            file_path=master_path,
            content_type="application/vnd.apple.mpegurl",
            bucket=storage.streams_bucket,
        )
