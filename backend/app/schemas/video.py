"""Video response schemas."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


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


class VideoResponse(BaseModel):
    """Public video representation with related entities."""

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
    actresses: list[VideoActressSummaryResponse] = Field(default_factory=list)
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
