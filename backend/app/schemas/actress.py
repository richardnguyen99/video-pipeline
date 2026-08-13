"""Actress response schemas."""

from datetime import datetime
from typing import Any, Literal, Optional, cast

from pydantic import BaseModel, ConfigDict, Field, field_validator

ActressImageAttributeLabel = Literal["fallback", "thumbnail", "avatar"]

_IMAGE_ATTRIBUTE_LABELS: dict[int, ActressImageAttributeLabel] = {
    0: "fallback",
    1: "thumbnail",
    2: "avatar",
}
_IMAGE_ATTRIBUTE_LABEL_SET: frozenset[str] = frozenset(
    _IMAGE_ATTRIBUTE_LABELS.values(),
)


class ActressAkaResponse(BaseModel):
    """Alternative name for an actress."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    translated_name: str


class ActressImageResponse(BaseModel):
    """Image associated with an actress."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    url: str
    attribute: ActressImageAttributeLabel

    @field_validator("attribute", mode="before")
    @classmethod
    def map_attribute_code(cls, value: Any) -> ActressImageAttributeLabel:
        """Map numeric DB attribute codes to readable labels."""

        if isinstance(value, str) and value in _IMAGE_ATTRIBUTE_LABEL_SET:
            return cast(ActressImageAttributeLabel, value)

        if isinstance(value, int):
            label = _IMAGE_ATTRIBUTE_LABELS.get(value)

            if label is not None:
                return label

        return "fallback"


class ActressResponse(BaseModel):
    """Public actress representation including aka and images."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    ruby: Optional[str] = None
    image_url: Optional[str] = None
    dmm_id: Optional[str] = None
    bust: Optional[int] = None
    cup: Optional[str] = None
    waist: Optional[int] = None
    hip: Optional[int] = None
    height: Optional[int] = None
    birthday: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    actress_aka: Optional[ActressAkaResponse] = None
    actress_image: list[ActressImageResponse] = Field(default_factory=list)


class ActressListResponse(BaseModel):
    """Paginated actress list payload."""

    items: list[ActressResponse] = Field(default_factory=list)
    total: int = Field(ge=0)
    limit: int = Field(ge=1)
    offset: int = Field(ge=0)
