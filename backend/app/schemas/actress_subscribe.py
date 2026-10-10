"""Request and response schemas for actress subscriptions."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional, cast

from pydantic import BaseModel, ConfigDict, Field, field_validator

ActressImageAttributeLabel = Literal["thumbnail", "default", "avatar"]

_IMAGE_ATTRIBUTE_LABELS: dict[int, ActressImageAttributeLabel] = {
    0: "thumbnail",
    1: "default",
    2: "avatar",
}
_IMAGE_ATTRIBUTE_LABEL_SET: frozenset[str] = frozenset(
    _IMAGE_ATTRIBUTE_LABELS.values(),
)


class ActressSubscribeImage(BaseModel):
    """Image attached to a subscribed actress."""

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


class ActressSubscribeStatusResponse(BaseModel):
    """Subscription state for one actress from the caller's perspective."""

    actress_id: int = Field(ge=1)
    is_subscribed: bool
    sub_cnt: int = Field(ge=0)


class ActressSubscribeItem(BaseModel):
    """One actress in a user's subscription list."""

    actress_id: int = Field(ge=1)
    name: str
    image_url: Optional[str] = None
    ruby: Optional[str] = None
    birthday: Optional[str] = None
    bust: Optional[int] = None
    cup: Optional[str] = None
    waist: Optional[int] = None
    hip: Optional[int] = None
    height: Optional[int] = None
    view_cnt: int = Field(default=0, ge=0)
    like_cnt: int = Field(default=0, ge=0)
    image: list[ActressSubscribeImage] = Field(default_factory=list)
    subscribed_at: datetime


class ActressSubscribeListResponse(BaseModel):
    """Paginated list of actress subscriptions."""

    items: list[ActressSubscribeItem] = Field(default_factory=list)
    total: int = Field(ge=0)
    limit: int = Field(ge=1)
    offset: int = Field(ge=0)
