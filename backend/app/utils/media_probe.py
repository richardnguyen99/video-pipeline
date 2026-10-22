"""Probe media streams with ffprobe (source URL or local path)."""

from __future__ import annotations

import asyncio
import json
import logging
import math
from dataclasses import dataclass
from typing import Any, Optional

_logger = logging.getLogger("uvicorn.error")


@dataclass(frozen=True, slots=True)
class MediaProbeResult:
    """Normalized probe output for one source file."""

    duration_s: Optional[int]
    width: Optional[int]
    height: Optional[int]
    fps: Optional[float]
    video_codec: Optional[str]
    audio_codec: Optional[str]
    has_video: bool
    rotation: int


def _parse_fraction_fps(text: str) -> Optional[float]:
    num_s, den_s = text.split("/", 1)

    try:
        num = float(num_s)
        den = float(den_s)
    except ValueError:
        return None

    if den == 0:
        return None

    return round(num / den, 3)


def _parse_fps(value: object) -> Optional[float]:
    if value is None:
        return None

    text = str(value).strip()

    if not text or text in {"0/0", "N/A"}:
        return None

    if "/" in text:
        return _parse_fraction_fps(text)

    try:
        return round(float(text), 3)
    except ValueError:
        return None


def _rotation_from_stream(stream: dict[str, Any]) -> int:
    tags = stream.get("tags")

    if isinstance(tags, dict):
        rotate = tags.get("rotate")

        if rotate is not None:
            try:
                return int(str(rotate)) % 360
            except ValueError:
                pass

    side_data = stream.get("side_data_list")

    if isinstance(side_data, list):
        for item in side_data:
            if not isinstance(item, dict):
                continue

            if "rotation" in item:
                try:
                    return int(float(item["rotation"])) % 360
                except TypeError, ValueError:
                    continue

    return 0


def parse_ffprobe_payload(payload: dict[str, Any]) -> MediaProbeResult:
    """Parse ffprobe JSON into a ``MediaProbeResult``."""

    streams = payload.get("streams")

    if not isinstance(streams, list):
        streams = []

    video_stream: dict[str, Any] | None = None
    audio_codec: str | None = None

    for stream in streams:
        if not isinstance(stream, dict):
            continue

        codec_type = stream.get("codec_type")

        if codec_type == "video" and video_stream is None:
            video_stream = stream
        elif codec_type == "audio" and audio_codec is None:
            name = stream.get("codec_name")
            audio_codec = str(name) if name else None

    duration_s: int | None = None
    fmt = payload.get("format")

    if isinstance(fmt, dict) and fmt.get("duration") is not None:
        try:
            duration_s = max(0, int(round(float(fmt["duration"]))))
        except TypeError, ValueError:
            duration_s = None

    if video_stream is None:
        return MediaProbeResult(
            duration_s=duration_s,
            width=None,
            height=None,
            fps=None,
            video_codec=None,
            audio_codec=audio_codec,
            has_video=False,
            rotation=0,
        )

    width = video_stream.get("width")
    height = video_stream.get("height")
    rotation = _rotation_from_stream(video_stream)

    try:
        width_i = int(width) if width is not None else None
    except TypeError, ValueError:
        width_i = None

    try:
        height_i = int(height) if height is not None else None
    except TypeError, ValueError:
        height_i = None

    if rotation in {90, 270} and width_i is not None and height_i is not None:
        width_i, height_i = height_i, width_i

    fps = _parse_fps(
        video_stream.get("avg_frame_rate") or video_stream.get("r_frame_rate"),
    )
    codec_name = video_stream.get("codec_name")
    video_codec = str(codec_name) if codec_name else None

    return MediaProbeResult(
        duration_s=duration_s,
        width=width_i,
        height=height_i,
        fps=fps,
        video_codec=video_codec,
        audio_codec=audio_codec,
        has_video=True,
        rotation=rotation,
    )


async def probe_media(
    source: str, *, timeout_s: float = 120.0
) -> MediaProbeResult:
    """Run ffprobe against a local path or HTTP(S) URL."""

    command = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "stream=index,codec_type,codec_name,width,height,"
        "r_frame_rate,avg_frame_rate:format=duration",
        "-show_entries",
        "stream_side_data=rotation",
        "-show_entries",
        "stream_tags=rotate",
        "-of",
        "json",
        source,
    ]

    process = await asyncio.create_subprocess_exec(
        *command,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    try:
        stdout, stderr = await asyncio.wait_for(
            process.communicate(),
            timeout=timeout_s,
        )
    except TimeoutError as exc:
        process.kill()
        await process.wait()

        raise RuntimeError("ffprobe timed out") from exc

    if process.returncode != 0:
        err = stderr.decode("utf-8", errors="replace").strip()
        _logger.warning(
            "ffprobe failed code=%s err=%s", process.returncode, err
        )

        raise RuntimeError(err or f"ffprobe exited with {process.returncode}")

    try:
        payload = json.loads(stdout.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise RuntimeError("ffprobe returned invalid JSON") from exc

    if not isinstance(payload, dict):
        raise RuntimeError("ffprobe JSON root is not an object")

    return parse_ffprobe_payload(payload)


def plan_rendition_ladder(
    *,
    source_height: int,
    source_width: int,
    max_height: int = 1080,
) -> list[tuple[str, int, int, int, int]]:
    """Build ladder rungs: (label, width, height, video_kbps, audio_kbps).

    Never upscales; caps at ``max_height``.
    """

    ladder = (
        (240, 400, 64),
        (360, 800, 96),
        (480, 1400, 128),
        (720, 2800, 128),
        (1080, 5000, 128),
    )
    cap = min(max(1, source_height), max_height)
    aspect = source_width / source_height if source_height > 0 else 16 / 9
    plan: list[tuple[str, int, int, int, int]] = []

    for height, v_kbps, a_kbps in ladder:
        if height > cap:
            continue

        width = int(math.floor(height * aspect / 2) * 2)
        width = max(2, width)
        plan.append((f"{height}p", width, height, v_kbps, a_kbps))

    if not plan or plan[-1][2] < cap:
        width = int(math.floor(cap * aspect / 2) * 2)
        width = max(2, width)
        v_kbps = 5000 if cap >= 1080 else 2800 if cap >= 720 else 1400
        plan.append((f"{cap}p", width, cap, v_kbps, 128))

    return plan
