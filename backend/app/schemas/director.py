"""Director API response schemas."""

from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class DirectorResponse(BaseModel):
    """Single director in the list response."""

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        serialize_by_alias=True,
    )

    id: int
    name: str
    ruby: Optional[str] = None
    dmm_id: str = Field(serialization_alias="dmmId")


class DirectorListResponse(BaseModel):
    """Paginated director list payload."""

    model_config = ConfigDict(
        populate_by_name=True,
        serialize_by_alias=True,
    )

    items: list[DirectorResponse]
    total: int = Field(ge=0)
    limit: int = Field(ge=1)
    offset: int = Field(ge=0)
