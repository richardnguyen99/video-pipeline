"""Actress response schemas."""

from datetime import date, datetime
from typing import Any, Literal, Optional, cast

from pydantic import BaseModel, ConfigDict, Field, field_validator

ActressImageAttributeLabel = Literal["thumbnail", "default", "avatar"]

# DB integer codes → size labels (smallest → largest).
_IMAGE_ATTRIBUTE_LABELS: dict[int, ActressImageAttributeLabel] = {
    0: "thumbnail",
    1: "default",
    2: "avatar",
}
_IMAGE_ATTRIBUTE_LABEL_SET: frozenset[str] = frozenset(
    _IMAGE_ATTRIBUTE_LABELS.values(),
)


class ActressAkaResponse(BaseModel):
    """Alternative (translated) name for an actress."""

    model_config = ConfigDict(from_attributes=True)

    id: int
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
        """Map numeric DB attribute codes to size labels."""

        if isinstance(value, str) and value in _IMAGE_ATTRIBUTE_LABEL_SET:
            return cast(ActressImageAttributeLabel, value)

        if isinstance(value, int):
            label = _IMAGE_ATTRIBUTE_LABELS.get(value)

            if label is not None:
                return label

        return "thumbnail"


class ActressResponse(BaseModel):
    """Public actress representation for list/detail payloads."""

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )

    id: int
    name: str
    ruby: Optional[str] = None
    dmm_id: Optional[str] = None
    bust: Optional[int] = None
    cup: Optional[str] = None
    waist: Optional[int] = None
    hip: Optional[int] = None
    height: Optional[int] = None
    birthday: Optional[str] = None
    video_cnt: int = Field(default=0, ge=0)
    sub_cnt: int = Field(default=0, ge=0)
    view_cnt: int = Field(default=0, ge=0)
    aka: Optional[ActressAkaResponse] = Field(
        default=None,
        validation_alias="actress_aka",
    )
    image: list[ActressImageResponse] = Field(
        default_factory=list,
        validation_alias="actress_image",
    )

    @field_validator("birthday", mode="before")
    @classmethod
    def format_birthday(cls, value: Any) -> Optional[str]:
        """Normalize birthday to ``YYYY-MM-DD`` string."""

        if value is None or value == "":
            return None

        if isinstance(value, datetime):
            return value.date().isoformat()

        if isinstance(value, date):
            return value.isoformat()

        if isinstance(value, str):
            return value[:10]

        return str(value)


class ActressListResponse(BaseModel):
    """Paginated actress list payload."""

    items: list[ActressResponse] = Field(default_factory=list)
    total: int = Field(ge=0)
    limit: int = Field(ge=1)
    offset: int = Field(ge=0)
