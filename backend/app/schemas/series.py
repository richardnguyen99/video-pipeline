"""Series API response schemas."""

import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class SeriesResponse(BaseModel):
    """Single series in the list response."""

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        serialize_by_alias=True,
    )

    id: int
    name: str
    ruby: Optional[str] = None
    dmm_id: str = Field(serialization_alias="dmmId")


class SeriesListResponse(BaseModel):
    """Paginated series list payload."""

    model_config = ConfigDict(
        populate_by_name=True,
        serialize_by_alias=True,
    )

    items: list[SeriesResponse]
    total: int = Field(ge=0)
    limit: int = Field(ge=1)
    offset: int = Field(ge=0)


class SeriesAkaResponse(BaseModel):
    """Translated name entry for a series detail response."""

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


class SeriesDetailResponse(BaseModel):
    """Detailed single-series response."""

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
    akas: list[SeriesAkaResponse] = Field(default_factory=list)
