"""Request and response schemas for actress subscriptions."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ActressSubscribeStatusResponse(BaseModel):
    """Subscription state for one actress from the caller's perspective."""

    actress_id: int = Field(ge=1)
    is_subscribed: bool
    sub_cnt: int = Field(ge=0)


class ActressSubscribeItem(BaseModel):
    """One actress in a user's subscription list."""

    actress_id: int = Field(ge=1)
    name: str
    image_url: Optional[str] = None
    ruby: Optional[str] = None
    subscribed_at: datetime


class ActressSubscribeListResponse(BaseModel):
    """Paginated list of actress subscriptions."""

    items: list[ActressSubscribeItem] = Field(default_factory=list)
    total: int = Field(ge=0)
    limit: int = Field(ge=1)
    offset: int = Field(ge=0)
