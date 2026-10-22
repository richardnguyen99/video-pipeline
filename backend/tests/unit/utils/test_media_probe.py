"""Unit tests for ``app.utils.media_probe``."""

from __future__ import annotations

from app.utils.media_probe import parse_ffprobe_payload, plan_rendition_ladder


def test_parse_ffprobe_payload_extracts_video_and_audio() -> None:
    payload = {
        "streams": [
            {
                "codec_type": "video",
                "codec_name": "h264",
                "width": 1920,
                "height": 1080,
                "avg_frame_rate": "30000/1001",
            },
            {
                "codec_type": "audio",
                "codec_name": "aac",
            },
        ],
        "format": {"duration": "145.2"},
    }

    result = parse_ffprobe_payload(payload)

    assert result.has_video is True
    assert result.duration_s == 145
    assert result.width == 1920
    assert result.height == 1080
    assert result.fps == 29.97
    assert result.video_codec == "h264"
    assert result.audio_codec == "aac"


def test_parse_ffprobe_payload_swaps_dims_for_90_rotation() -> None:
    payload = {
        "streams": [
            {
                "codec_type": "video",
                "codec_name": "h264",
                "width": 1920,
                "height": 1080,
                "avg_frame_rate": "30/1",
                "tags": {"rotate": "90"},
            },
        ],
        "format": {"duration": "10"},
    }

    result = parse_ffprobe_payload(payload)

    assert result.width == 1080
    assert result.height == 1920
    assert result.rotation == 90


def test_parse_ffprobe_payload_no_video() -> None:
    payload = {
        "streams": [{"codec_type": "audio", "codec_name": "aac"}],
        "format": {"duration": "3"},
    }

    result = parse_ffprobe_payload(payload)

    assert result.has_video is False
    assert result.video_codec is None
    assert result.audio_codec == "aac"


def test_plan_rendition_ladder_never_upscales_480p() -> None:
    plan = plan_rendition_ladder(source_height=480, source_width=854)

    heights = [row[2] for row in plan]

    assert max(heights) == 480
    assert 240 in heights
    assert 360 in heights
    assert 1080 not in heights


def test_plan_rendition_ladder_caps_4k_at_1080() -> None:
    plan = plan_rendition_ladder(source_height=2160, source_width=3840)

    heights = [row[2] for row in plan]

    assert max(heights) == 1080
    assert 720 in heights
