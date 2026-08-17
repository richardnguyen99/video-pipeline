"""Video response schemas."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.actress import ActressAkaResponse, ActressImageResponse


class VideoCatalogEntityResponse(BaseModel):
    """Lightweight catalog entity linked to a video."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    ruby: Optional[str] = None
    dmm_id: Optional[str] = None


class VideoActressSummaryResponse(BaseModel):
    """Actress summary embedded on a video list item."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    ruby: Optional[str] = None
    image_url: Optional[str] = None


class VideoActressDetailResponse(BaseModel):
    """Actress embedded on a video detail payload."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    ruby: Optional[str] = None
    image_url: Optional[str] = None
    dmm_id: Optional[str] = None
    actress_aka: Optional[ActressAkaResponse] = None
    actress_image: list[ActressImageResponse] = Field(default_factory=list)


class VideoImageUrlResponse(BaseModel):
    """Image URL associated with a video."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    url: str
    type: Optional[str] = None


class VideoSampleImageUrlResponse(BaseModel):
    """Sample still image URL associated with a video."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    url: str
    type: Optional[str] = None


class VideoSampleMovieUrlResponse(BaseModel):
    """Sample movie URL associated with a video."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    url: str
    type: Optional[str] = None


class VideoEngagementCounts(BaseModel):
    """Aggregate engagement totals for one video."""

    views: int = Field(default=0, ge=0)
    likes: int = Field(default=0, ge=0)
    dislikes: int = Field(default=0, ge=0)
    comments: int = Field(default=0, ge=0)


class VideoResponse(BaseModel):
    """Public video representation for list endpoints (no nested relations)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    video_id: str
    title: Optional[str] = None
    cid: Optional[str] = None
    duration: Optional[int] = None
    release_date: Optional[datetime] = None
    jancode: Optional[str] = None
    maker_product: Optional[str] = None
    floor_code: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    views: int = Field(default=0, ge=0)
    likes: int = Field(default=0, ge=0)
    dislikes: int = Field(default=0, ge=0)
    comments: int = Field(default=0, ge=0)


class VideoDetailResponse(BaseModel):
    """Full video payload including detailed actress relations."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    video_id: str
    title: Optional[str] = None
    cid: Optional[str] = None
    duration: Optional[int] = None
    release_date: Optional[datetime] = None
    jancode: Optional[str] = None
    maker_product: Optional[str] = None
    floor_code: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    actresses: list[VideoActressDetailResponse] = Field(default_factory=list)
    genres: list[VideoCatalogEntityResponse] = Field(default_factory=list)
    series: list[VideoCatalogEntityResponse] = Field(default_factory=list)
    makers: list[VideoCatalogEntityResponse] = Field(default_factory=list)
    labels: list[VideoCatalogEntityResponse] = Field(default_factory=list)
    directors: list[VideoCatalogEntityResponse] = Field(default_factory=list)
    video_image_url: list[VideoImageUrlResponse] = Field(default_factory=list)
    video_sample_image_url: list[VideoSampleImageUrlResponse] = Field(
        default_factory=list,
    )
    video_sample_movie_url: list[VideoSampleMovieUrlResponse] = Field(
        default_factory=list,
    )


class VideoListResponse(BaseModel):
    """Paginated video list payload."""

    items: list[VideoResponse] = Field(default_factory=list)
    total: int = Field(ge=0)
    limit: int = Field(ge=1)
    offset: int = Field(ge=0)
