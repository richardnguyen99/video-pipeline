"""Label API response schemas."""

import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class LabelResponse(BaseModel):
    """Single label in the list response."""

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        serialize_by_alias=True,
    )

    id: int
    name: str
    ruby: Optional[str] = None
    dmm_id: str = Field(serialization_alias="dmmId")


class LabelListResponse(BaseModel):
    """Paginated label list payload."""

    model_config = ConfigDict(
        populate_by_name=True,
        serialize_by_alias=True,
    )

    items: list[LabelResponse]
    total: int = Field(ge=0)
    limit: int = Field(ge=1)
    offset: int = Field(ge=0)


class LabelAkaResponse(BaseModel):
    """Translated name entry for a label detail response."""

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        serialize_by_alias=True,
    )

    id: int
    name: str
    language: str
    created_at: datetime.datetime = Field(serialization_alias="createdAt")
    updated_at: datetime.datetime = Field(serialization_alias="updatedAt")


class LabelDetailResponse(BaseModel):
    """Detailed single-label response."""

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        serialize_by_alias=True,
    )

    id: int
    name: str
    ruby: Optional[str] = None
    dmm_id: str = Field(serialization_alias="dmmId")
    created_at: datetime.datetime = Field(serialization_alias="createdAt")
    updated_at: datetime.datetime = Field(serialization_alias="updatedAt")
    akas: list[LabelAkaResponse] = Field(default_factory=list)
