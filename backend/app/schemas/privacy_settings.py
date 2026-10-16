"""Request and response schemas for user privacy settings."""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class PrivacySettingsResponse(BaseModel):
    """Current privacy preferences for the authenticated user."""

    model_config = ConfigDict(from_attributes=True)

    id: Optional[UUID] = None
    show_watched_videos: bool = False
    show_liked_videos: bool = False
    show_subscriptions: bool = True
    show_comment_history: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class PrivacySettingsUpdateRequest(BaseModel):
    """Replace privacy settings for the authenticated user."""

    show_watched_videos: bool = Field(
        description="Whether watched videos are visible on the public profile.",
    )
    show_liked_videos: bool = Field(
        description="Whether liked videos are visible on the public profile.",
    )
    show_subscriptions: bool = Field(
        description=(
            "Whether subscriptions (creators/actresses) are visible "
            "on the public profile."
        ),
    )
    show_comment_history: bool = Field(
        description="Whether comment history is visible on the public profile.",
    )
