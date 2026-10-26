"""Encode HLS ladder with ffmpeg (MPEG-TS segments) and parse progress."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from app.config import settings
from app.messaging.transcode_pool import run_in_transcode_pool

_logger = logging.getLogger("uvicorn.error")

ProgressCallback = Callable[[float], Awaitable[None]]

_DEFAULT_PRESET = "veryfast"
_MIN_SEGMENT_SECONDS = 2


@dataclass(frozen=True, slots=True)
class RenditionSpec:
    """One ladder rung to encode."""

    label: str
    height: int
    video_kbps: int
    audio_kbps: int


def _segment_seconds() -> int:
    return max(_MIN_SEGMENT_SECONDS, int(settings.transcode_chunk_seconds))


def _rate_args(video_kbps: int) -> tuple[str, str]:
    """Return ``(maxrate, bufsize)`` ffmpeg rate strings."""

    return f"{int(video_kbps * 1.1)}k", f"{int(video_kbps * 1.5)}k"


def _hls_output_args(playlist: Path, segment_pattern: str) -> list[str]:
    """Shared HLS muxer flags for MPEG-TS VOD output."""

    segment_time = str(_segment_seconds())

    return [
        "-f",
        "hls",
        "-hls_time",
        segment_time,
        "-hls_list_size",
        "0",
        "-hls_playlist_type",
        "vod",
        "-hls_segment_type",
        "mpegts",
        "-hls_flags",
        "independent_segments",
        "-hls_segment_filename",
        segment_pattern,
        str(playlist),
    ]


def _x264_audio_args(
    *,
    preset: str,
    video_kbps: int,
    audio_kbps: int,
) -> list[str]:
    """libx264 + AAC encode flags for one output."""

    maxrate, bufsize = _rate_args(video_kbps)
    keyframe_interval = _segment_seconds()

    return [
        "-c:v",
        "libx264",
        "-profile:v",
        "high",
        "-preset",
        preset,
        "-b:v",
        f"{video_kbps}k",
        "-maxrate",
        maxrate,
        "-bufsize",
        bufsize,
        "-force_key_frames",
        f"expr:gte(t,n_forced*{keyframe_interval})",
        "-sc_threshold",
        "0",
        "-c:a",
        "aac",
        "-b:a",
        f"{audio_kbps}k",
        "-ac",
        "2",
    ]


def build_ffmpeg_command(
    *,
    source: str,
    out_dir: Path,
    height: int,
    video_kbps: int,
    audio_kbps: int,
    preset: str = _DEFAULT_PRESET,
) -> list[str]:
    """Build the ffmpeg argv for one HLS MPEG-TS rendition (single process)."""

    playlist = out_dir / "playlist.m3u8"
    segment_pattern = str(out_dir / "seg_%05d.ts")

    return [
        "ffmpeg",
        "-y",
        "-i",
        source,
        "-map",
        "0:v:0",
        "-map",
        "0:a:0?",
        "-vf",
        f"scale=-2:{height},format=yuv420p",
        *_x264_audio_args(
            preset=preset,
            video_kbps=video_kbps,
            audio_kbps=audio_kbps,
        ),
        *_hls_output_args(playlist, segment_pattern),
        "-progress",
        "pipe:1",
        "-nostats",
    ]


def _ladder_filter_complex(specs: Sequence[RenditionSpec]) -> str:
    n = len(specs)
    split_labels = "".join(f"[v{i}]" for i in range(n))
    parts = [f"[0:v]split={n}{split_labels}"]

    for index, spec in enumerate(specs):
        parts.append(
            f"[v{index}]scale=-2:{spec.height},format=yuv420p[o{index}]",
        )

    return ";".join(parts)


def _ladder_output_args(
    *,
    work_dir: Path,
    index: int,
    spec: RenditionSpec,
    preset: str,
) -> list[str]:
    out_dir = work_dir / spec.label
    out_dir.mkdir(parents=True, exist_ok=True)
    playlist = out_dir / "playlist.m3u8"
    segment_pattern = str(out_dir / "seg_%05d.ts")

    return [
        "-map",
        f"[o{index}]",
        "-map",
        "0:a:0?",
        *_x264_audio_args(
            preset=preset,
            video_kbps=spec.video_kbps,
            audio_kbps=spec.audio_kbps,
        ),
        *_hls_output_args(playlist, segment_pattern),
    ]


def build_ladder_ffmpeg_command(
    *,
    source: str,
    work_dir: Path,
    specs: Sequence[RenditionSpec],
    preset: str = _DEFAULT_PRESET,
) -> list[str]:
    """Build one ffmpeg command that encodes every ladder rung in a single pass."""

    if not specs:
        raise ValueError("specs must not be empty")

    command: list[str] = [
        "ffmpeg",
        "-y",
        "-i",
        source,
        "-filter_complex",
        _ladder_filter_complex(specs),
    ]

    for index, spec in enumerate(specs):
        command.extend(
            _ladder_output_args(
                work_dir=work_dir,
                index=index,
                spec=spec,
                preset=preset,
            ),
        )

    command.extend(["-progress", "pipe:1", "-nostats"])

    return command


def build_master_playlist(
    renditions: list[tuple[str, int, int, int]],
) -> str:
    """Build master ``index.m3u8`` text.

    Args:
        renditions: ``(label, width, height, video_kbps)`` for READY rungs.
    """

    lines = ["#EXTM3U", "#EXT-X-VERSION:3"]

    for label, width, height, video_kbps in sorted(
        renditions,
        key=lambda row: row[2],
    ):
        bandwidth = int((video_kbps + 128) * 1000)
        lines.append(
            f"#EXT-X-STREAM-INF:BANDWIDTH={bandwidth},"
            f"RESOLUTION={width}x{height},"
            f'CODECS="avc1.64001f,mp4a.40.2"',
        )
        lines.append(f"{label}/playlist.m3u8")

    return "\n".join(lines) + "\n"


class FfmpegError(RuntimeError):
    """ffmpeg exited non-zero or was terminated by a signal."""

    def __init__(
        self,
        message: str,
        *,
        returncode: int,
        signal: Optional[int] = None,
        stderr_tail: str = "",
    ) -> None:
        super().__init__(message)
        self.returncode = returncode
        self.signal = signal
        self.stderr_tail = stderr_tail


def _format_ffmpeg_failure(returncode: int, stderr_text: str) -> FfmpegError:
    """Build a structured error for a failed or killed ffmpeg process."""

    signal: Optional[int] = None

    if returncode < 0:
        signal = -returncode
        reason = f"terminated by signal {signal}"
    elif returncode > 128:
        signal = returncode - 128
        reason = f"terminated by signal {signal} (exit {returncode})"
    else:
        reason = f"exited with code {returncode}"

    tail = stderr_text.strip()[-2000:]
    message = f"ffmpeg {reason}"

    if tail:
        message = f"{message}: {tail}"

    return FfmpegError(
        message,
        returncode=returncode,
        signal=signal,
        stderr_tail=tail,
    )


async def _drain_stderr(stream: asyncio.StreamReader) -> bytes:
    """Read stderr continuously so the OS pipe buffer never fills."""

    chunks: list[bytes] = []

    while True:
        chunk = await stream.read(65_536)

        if not chunk:
            break

        chunks.append(chunk)

    return b"".join(chunks)


def _parse_progress_seconds(line: str) -> Optional[float]:
    """Parse ``out_time_ms`` / ``out_time`` progress lines into seconds."""

    if line.startswith("out_time_ms="):
        try:
            return int(line.split("=", 1)[1]) / 1_000_000.0
        except ValueError:
            return None

    if line.startswith("out_time="):
        try:
            parts = line.split("=", 1)[1].split(":")

            return (
                float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])
            )
        except IndexError, ValueError:
            return None

    return None


async def _consume_progress_stdout(
    stdout: asyncio.StreamReader,
    *,
    duration_s: Optional[float],
    on_progress: Optional[ProgressCallback],
    label: str,
    pid: Optional[int],
) -> None:
    """Read ffmpeg ``-progress`` lines and emit throttled callbacks."""

    last_reported = -1.0
    last_logged_pct = -5.0

    while True:
        line_b = await stdout.readline()

        if not line_b:
            break

        line = line_b.decode("utf-8", errors="replace").strip()
        seconds = _parse_progress_seconds(line)

        if seconds is None or duration_s is None or duration_s <= 0:
            continue

        pct = max(0.0, min(100.0, (seconds / duration_s) * 100.0))

        if pct - last_logged_pct >= 5.0 or pct >= 100.0:
            last_logged_pct = pct
            _logger.info(
                "%s progress pid=%s pct=%.1f out_time=%.1fs",
                label,
                pid,
                pct,
                seconds,
            )

        if on_progress is None:
            continue

        if pct - last_reported < 1.0 and pct < 100.0:
            continue

        last_reported = pct
        await on_progress(pct)


async def _kill_process(process: asyncio.subprocess.Process) -> None:
    if process.returncode is None:
        process.kill()
        await process.wait()


async def _run_ffmpeg_with_progress(
    command: list[str],
    *,
    duration_s: Optional[float],
    on_progress: Optional[ProgressCallback],
    label: str = "ffmpeg",
) -> None:
    """Run ffmpeg and optionally report overall progress from ``out_time``."""

    _logger.info(
        "%s starting pid=pending args=%s duration_s=%s",
        label,
        " ".join(command[:12]) + (" …" if len(command) > 12 else ""),
        duration_s,
    )

    process = await asyncio.create_subprocess_exec(
        *command,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    _logger.info("%s started pid=%s", label, process.pid)

    assert process.stdout is not None
    assert process.stderr is not None

    stderr_task = asyncio.create_task(_drain_stderr(process.stderr))

    try:
        await _consume_progress_stdout(
            process.stdout,
            duration_s=duration_s,
            on_progress=on_progress,
            label=label,
            pid=process.pid,
        )
    except asyncio.CancelledError:
        _logger.error("%s cancelled; killing pid=%s", label, process.pid)
        await _kill_process(process)
        stderr_task.cancel()

        raise

    code = await process.wait()
    stderr_text = (await stderr_task).decode("utf-8", errors="replace")

    if code != 0:
        error = _format_ffmpeg_failure(
            code if code is not None else -1, stderr_text
        )
        _logger.error(
            "%s failed pid=%s returncode=%s signal=%s stderr_tail=%s",
            label,
            process.pid,
            error.returncode,
            error.signal,
            error.stderr_tail[-500:] if error.stderr_tail else "",
        )

        raise error

    _logger.info("%s finished ok pid=%s", label, process.pid)

    if on_progress is not None:
        await on_progress(100.0)


async def encode_hls_rendition(
    *,
    source: str,
    out_dir: Path,
    height: int,
    video_kbps: int,
    audio_kbps: int,
    duration_s: Optional[float],
    on_progress: Optional[ProgressCallback] = None,
    preset: str = _DEFAULT_PRESET,
) -> Path:
    """Encode one ladder rung with a single continuous HLS ffmpeg pass.

    Parallel ``-ss/-t`` chunk encodes are intentionally not used here: each
    chunk resets MPEG-TS timestamps, which breaks seeking and duration in
    hls.js even when every ``.ts`` object exists in storage. Concurrency is
    still bounded by the global transcode pool across jobs and rungs.
    """

    out_dir.mkdir(parents=True, exist_ok=True)
    command = build_ffmpeg_command(
        source=source,
        out_dir=out_dir,
        height=height,
        video_kbps=video_kbps,
        audio_kbps=audio_kbps,
        preset=preset,
    )
    label = f"ffmpeg:rendition:{height}p"

    async def _run() -> None:
        await _run_ffmpeg_with_progress(
            command,
            duration_s=duration_s,
            on_progress=on_progress,
            label=label,
        )

    await run_in_transcode_pool(_run, label=label)

    playlist = out_dir / "playlist.m3u8"

    if not playlist.is_file():
        raise RuntimeError("ffmpeg did not produce playlist.m3u8")

    return playlist


async def encode_hls_ladder(
    *,
    source: str,
    work_dir: Path,
    specs: Sequence[RenditionSpec],
    duration_s: Optional[float],
    on_progress: Optional[ProgressCallback] = None,
    preset: str = _DEFAULT_PRESET,
) -> list[Path]:
    """Encode every rung in one ffmpeg pass; return playlist paths."""

    if not specs:
        return []

    work_dir.mkdir(parents=True, exist_ok=True)
    labels = ",".join(spec.label for spec in specs)
    label = f"ffmpeg:ladder:{labels}"
    command = build_ladder_ffmpeg_command(
        source=source,
        work_dir=work_dir,
        specs=specs,
        preset=preset,
    )

    async def _run() -> None:
        await _run_ffmpeg_with_progress(
            command,
            duration_s=duration_s,
            on_progress=on_progress,
            label=label,
        )

    await run_in_transcode_pool(_run, label=label)

    playlists: list[Path] = []

    for spec in specs:
        playlist = work_dir / spec.label / "playlist.m3u8"

        if not playlist.is_file():
            raise RuntimeError(
                f"ffmpeg did not produce playlist for {spec.label}",
            )

        playlists.append(playlist)

    return playlists
