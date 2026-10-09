"""Request and response schemas for user playlists."""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.playlist import PlaylistVisibility
from app.schemas.video import VideoResponse


class PlaylistCreateRequest(BaseModel):
    """Body for creating a playlist."""

    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=2000)
    visibility: PlaylistVisibility = Field(
        default=PlaylistVisibility.PRIVATE,
    )


class PlaylistUpdateRequest(BaseModel):
    """Partial update for playlist metadata."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=2000)
    visibility: Optional[PlaylistVisibility] = None


class PlaylistVisibilityChangeRequest(BaseModel):
    """Body for changing only playlist visibility."""

    visibility: PlaylistVisibility


class PlaylistAddVideoRequest(BaseModel):
    """Body for adding a video to a playlist."""

    video_id: int = Field(ge=1)


class PlaylistResponse(BaseModel):
    """Playlist summary for list and mutation responses."""

    id: UUID
    owner_id: UUID
    name: str
    description: Optional[str] = None
    visibility: PlaylistVisibility
    video_count: int = Field(default=0, ge=0)
    thumbnail_url: Optional[str] = None
    contains_video: bool | None = None
    created_at: datetime
    updated_at: datetime


class PlaylistListResponse(BaseModel):
    """Paginated playlist summaries."""

    items: list[PlaylistResponse] = Field(default_factory=list)
    total: int = Field(ge=0)
    limit: int = Field(ge=1)
    offset: int = Field(ge=0)


class PlaylistDetailResponse(PlaylistResponse):
    """Playlist with ordered video cards."""

    videos: list[VideoResponse] = Field(default_factory=list)


class PlaylistShareRequest(BaseModel):
    """Body for granting restricted playlist access to a user."""

    username: str = Field(min_length=1, max_length=64)


class PlaylistShareResponse(BaseModel):
    """A user who can view a restricted playlist."""

    user_id: UUID
    username: str
    display_name: Optional[str] = None
    created_at: datetime


class PlaylistShareListResponse(BaseModel):
    """Shared users for a restricted playlist."""

    items: list[PlaylistShareResponse] = Field(default_factory=list)
    total: int = Field(ge=0)
