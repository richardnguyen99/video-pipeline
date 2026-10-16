"""Request and response schemas for user notification settings."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

PreferredLanguageLiteral = Literal[
    "en",
    "es",
    "fr",
    "ja",
    "de",
]


class NotificationSettingsResponse(BaseModel):
    """Current notification preferences for the authenticated user."""

    model_config = ConfigDict(from_attributes=True)

    id: Optional[UUID] = None
    preferred_language: PreferredLanguageLiteral = "en"
    notify_followed_videos: bool = True
    notify_public_video_activity: bool = True
    notify_public_playlist_activity: bool = True
    notify_comment_replies: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class NotificationSettingsUpdateRequest(BaseModel):
    """Replace notification settings for the authenticated user."""

    preferred_language: PreferredLanguageLiteral = Field(
        description="Language for account notices (ISO-ish short code).",
    )
    notify_followed_videos: bool = Field(
        description="Notify when followed creators post new videos.",
    )
    notify_public_video_activity: bool = Field(
        description="Notify on likes/comments on the user's public videos.",
    )
    notify_public_playlist_activity: bool = Field(
        description="Notify on likes/comments on the user's public playlists.",
    )
    notify_comment_replies: bool = Field(
        description="Notify on likes/replies to the user's comments.",
    )
