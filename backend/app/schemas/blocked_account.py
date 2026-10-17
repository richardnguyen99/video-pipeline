"""Request and response schemas for blocked accounts."""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class BlockedAccountItem(BaseModel):
    """A single blocked user entry for the authenticated blocker."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(description="Blocked user id.")
    username: str
    display_name: Optional[str] = None
    initials: str
    blocked_at: datetime


class BlockedAccountListResponse(BaseModel):
    """Pageless list of accounts blocked by the authenticated user."""

    items: list[BlockedAccountItem]
    total: int


class BlockUserRequest(BaseModel):
    """Identify the user to block by id and/or username."""

    user_id: Optional[UUID] = Field(
        default=None,
        description="Target user id.",
    )
    username: Optional[str] = Field(
        default=None,
        max_length=50,
        description="Target username (case-sensitive handle).",
    )

    @model_validator(mode="after")
    def require_identity(self) -> "BlockUserRequest":
        """Require at least one of ``user_id`` or ``username``."""

        if self.user_id is None and (
            self.username is None or self.username.strip() == ""
        ):
            raise ValueError("Provide user_id or username.")

        return self
