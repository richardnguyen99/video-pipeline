"""Genre API response schemas."""

import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class GenreResponse(BaseModel):
    """Single genre in the list response."""

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        serialize_by_alias=True,
    )

    id: int
    name: str
    ruby: Optional[str] = None
    dmm_id: str = Field(serialization_alias="dmmId")


class GenreAkaResponse(BaseModel):
    """Translated name entry for a genre detail response."""

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


class GenreDetailResponse(BaseModel):
    """Detailed single-genre response."""

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
    akas: list[GenreAkaResponse] = Field(default_factory=list)
