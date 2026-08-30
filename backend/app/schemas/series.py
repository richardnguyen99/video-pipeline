"""Series API response schemas."""

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
