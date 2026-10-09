"""Public user search schemas."""

from __future__ import annotations

from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class UserSearchItem(BaseModel):
    """A user match for typeahead / share suggestions."""

    id: UUID
    username: str
    email: str
    display_name: Optional[str] = None


class UserSearchResponse(BaseModel):
    """Pageless list of user search matches."""

    items: list[UserSearchItem] = Field(default_factory=list)
