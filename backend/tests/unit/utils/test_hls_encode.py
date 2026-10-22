"""Unit tests for ``app.utils.hls_encode``."""

from __future__ import annotations

from pathlib import Path

from app.utils.hls_encode import (
    RenditionSpec,
    build_ffmpeg_command,
    build_ladder_ffmpeg_command,
    build_master_playlist,
)


def test_build_ffmpeg_command_uses_mpegts_segments() -> None:
    out = Path("/tmp/out/720p")
    cmd = build_ffmpeg_command(
        source="https://example.com/src.mp4",
        out_dir=out,
        height=720,
        video_kbps=2800,
        audio_kbps=128,
    )

    assert "ffmpeg" in cmd
    assert "-hls_segment_type" in cmd
    assert "mpegts" in cmd
    assert "fmp4" not in cmd
    assert str(out / "seg_%05d.ts") in cmd
    assert str(out / "playlist.m3u8") in cmd
    assert "scale=-2:720,format=yuv420p" in cmd
    assert "veryfast" in cmd


def test_build_ladder_ffmpeg_command_single_pass_split() -> None:
    work = Path("/tmp/hls-work")
    specs = [
        RenditionSpec(
            label="480p", height=480, video_kbps=1400, audio_kbps=128
        ),
        RenditionSpec(
            label="720p", height=720, video_kbps=2800, audio_kbps=128
        ),
    ]
    cmd = build_ladder_ffmpeg_command(
        source="https://example.com/src.mp4",
        work_dir=work,
        specs=specs,
    )

    joined = " ".join(cmd)

    assert "-filter_complex" in cmd
    assert "split=2" in joined
    assert "scale=-2:480" in joined
    assert "scale=-2:720" in joined
    assert str(work / "480p" / "playlist.m3u8") in cmd
    assert str(work / "720p" / "playlist.m3u8") in cmd
    assert cmd.count("-i") == 1
    assert "veryfast" in cmd


def test_build_master_playlist_lists_playlist_m3u8_per_rendition() -> None:
    text = build_master_playlist(
        [
            ("1080p", 1920, 1080, 5000),
            ("720p", 1280, 720, 2800),
        ],
    )

    assert text.startswith("#EXTM3U")
    assert "720p/playlist.m3u8" in text
    assert "1080p/playlist.m3u8" in text
    assert text.index("720p") < text.index("1080p")
    assert "BANDWIDTH=" in text
