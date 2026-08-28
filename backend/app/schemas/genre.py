"""Genre API response schemas."""

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
