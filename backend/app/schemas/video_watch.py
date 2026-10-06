"""Request and response schemas for the watch / play pipeline."""

from __future__ import annotations

import math
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.video import VideoResponse


def _require_finite_non_negative_seconds(value: object) -> float:
    """Reject NaN, infinity, and negative playback positions."""

    if isinstance(value, bool) or not isinstance(value, (int, float, str)):
        raise ValueError("position_seconds must be a finite number.")

    try:
        as_float = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("position_seconds must be a finite number.") from exc

    if not math.isfinite(as_float):
        raise ValueError("position_seconds must be a finite number.")

    if as_float < 0:
        raise ValueError("position_seconds must be >= 0.")

    return as_float


class PlayStartRequest(BaseModel):
    """Optional body when starting a playback session."""

    playback_session_id: Optional[UUID] = Field(
        default=None,
        description="Client-generated session id; server generates one if omitted.",
    )
    position_seconds: float = Field(
        default=0.0,
        ge=0,
        description="Starting playback position (seek / resume).",
    )


class PlayStartResponse(BaseModel):
    """Result of POST /videos/{id}/play."""

    playback_session_id: UUID
    video_id: int
    is_eligible: bool
    position_seconds: float
    total_view_count: int
    cooldown_seconds: int
    heartbeat_interval_seconds: int
    eligible_threshold_seconds: float


class HeartbeatRequest(BaseModel):
    """~10s heartbeat while the player is running."""

    playback_session_id: UUID
    position_seconds: float = Field(..., ge=0)
    watched_seconds_delta: Optional[float] = Field(
        default=None,
        ge=0,
        description="Seconds watched since last heartbeat; defaults to interval.",
    )


class HeartbeatResponse(BaseModel):
    """Ack for a heartbeat."""

    playback_session_id: UUID
    video_id: int
    position_seconds: float
    accepted: bool


class VideoWatchProgressResponse(BaseModel):
    """Per-user watch progress for a single video."""

    model_config = ConfigDict(from_attributes=True)

    video_id: int
    position_seconds: float
    watch_count: int
    last_watched_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class VideoWatchProgressListResponse(BaseModel):
    """Paginated list of a user's watched videos progress."""

    items: list[VideoWatchProgressResponse]
    total: int
    limit: int
    offset: int


class RecordWatchRequest(BaseModel):
    """Legacy payload kept for schema tests / compatibility."""

    position_seconds: float = Field(default=0.0)

    @field_validator("position_seconds", mode="before")
    @classmethod
    def validate_position(cls, value: object) -> float:
        return _require_finite_non_negative_seconds(value)


class UpdateWatchProgressRequest(BaseModel):
    """Legacy seek-only payload."""

    position_seconds: float = Field(...)

    @field_validator("position_seconds", mode="before")
    @classmethod
    def validate_position(cls, value: object) -> float:
        return _require_finite_non_negative_seconds(value)


class RecordWatchResponse(BaseModel):
    """Legacy record-watch response."""

    video_id: int
    view_id: UUID
    position_seconds: float
    watch_count: int
    total_views: int


class WatchedVideoItem(VideoResponse):
    """Video list item with resume progress for watch history."""

    position_seconds: float = Field(default=0.0, ge=0)


class WatchedVideoListResponse(BaseModel):
    """Paginated watched video cards with seek progress."""

    items: list[WatchedVideoItem] = Field(default_factory=list)
    total: int = Field(ge=0)
    limit: int = Field(ge=1)
    offset: int = Field(ge=0)
