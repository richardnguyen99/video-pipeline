"""Schemas for account deactivation."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class DeactivateAccountResponse(BaseModel):
    """Result of soft-deactivating the authenticated account."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    username: str
    is_active: bool = Field(description="Always false after deactivation.")
    deactivated_at: datetime
