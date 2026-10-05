"""Unit tests for ``app.schemas.video_watch``."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas.video_watch import (
    RecordWatchRequest,
    UpdateWatchProgressRequest,
)


def test_record_watch_request_defaults_position_to_zero() -> None:
    """Omitting position uses zero seconds."""

    payload = RecordWatchRequest()

    assert payload.position_seconds == 0.0


def test_record_watch_request_accepts_position() -> None:
    """Positive positions are accepted."""

    payload = RecordWatchRequest(position_seconds=125.5)

    assert payload.position_seconds == 125.5


def test_record_watch_request_rejects_negative_position() -> None:
    """Negative positions are rejected."""

    with pytest.raises(ValidationError):
        RecordWatchRequest(position_seconds=-1)


@pytest.mark.parametrize("value", [float("inf"), float("nan")])
def test_record_watch_request_rejects_non_finite_position(
    value: float,
) -> None:
    """NaN/Infinity positions are rejected."""

    with pytest.raises(ValidationError):
        RecordWatchRequest(position_seconds=value)


def test_update_progress_requires_position() -> None:
    """Progress updates require an explicit position."""

    with pytest.raises(ValidationError):
        UpdateWatchProgressRequest()  # type: ignore[call-arg]


def test_update_progress_rejects_negative_position() -> None:
    """Negative seek positions are rejected."""

    with pytest.raises(ValidationError):
        UpdateWatchProgressRequest(position_seconds=-0.1)


@pytest.mark.parametrize("value", [float("inf"), float("nan")])
def test_update_progress_rejects_non_finite_position(
    value: float,
) -> None:
    """NaN/Infinity seek positions are rejected."""

    with pytest.raises(ValidationError):
        UpdateWatchProgressRequest(position_seconds=value)
