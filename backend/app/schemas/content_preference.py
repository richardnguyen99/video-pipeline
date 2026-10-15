"""Request and response schemas for user content preferences."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

PreferencePolarityLiteral = Literal["interest", "dislike"]
PreferenceEntityTypeLiteral = Literal[
    "actress",
    "maker",
    "genre",
    "series",
    "label",
    "director",
]


class ContentPreferenceItem(BaseModel):
    """One interest or dislike entry."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    polarity: PreferencePolarityLiteral
    entity_type: PreferenceEntityTypeLiteral
    entity_id: int = Field(ge=1)
    entity_name: Optional[str] = None
    created_at: datetime


class ContentPreferenceListResponse(BaseModel):
    """All content preferences for the authenticated user."""

    interests: list[ContentPreferenceItem] = Field(default_factory=list)
    dislikes: list[ContentPreferenceItem] = Field(default_factory=list)


class ContentPreferenceCreateRequest(BaseModel):
    """Add or replace a preference for one catalog entity."""

    polarity: PreferencePolarityLiteral
    entity_type: PreferenceEntityTypeLiteral
    entity_id: int = Field(ge=1)


class ContentPreferenceReplaceRequest(BaseModel):
    """Replace every preference of one polarity with the given items."""

    items: list[ContentPreferenceCreateRequest] = Field(default_factory=list)
