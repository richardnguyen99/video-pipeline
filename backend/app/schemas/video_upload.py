"""Schemas for user video upload (Model B: one video row per upload)."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class VideoUploadCreateRequest(BaseModel):
    """Start a raw multipart upload into the private bucket."""

    filename: str = Field(min_length=1, max_length=512)
    content_type: str = Field(
        default="application/octet-stream",
        max_length=128,
    )
    size_bytes: int = Field(gt=0, le=20 * 1024 * 1024 * 1024)
    title: Optional[str] = Field(default=None, max_length=1024)
    video_code: Optional[str] = Field(
        default=None,
        max_length=255,
        description="Optional business code used to prefill metadata.",
    )
    allow_upsert: bool = Field(
        default=False,
        description=(
            "When true and the caller is an admin, update an existing "
            "video row that already uses this video_code instead of "
            "rejecting the upload."
        ),
    )
    part_size_bytes: int = Field(
        default=8 * 1024 * 1024,
        ge=5 * 1024 * 1024,
        le=64 * 1024 * 1024,
    )


class ExistingVideoSummary(BaseModel):
    """Catalog fields returned when a video_code already exists (409)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    video_id: str
    title: Optional[str] = None
    cid: Optional[str] = None
    jancode: Optional[str] = None
    maker_product: Optional[str] = None
    release_date: Optional[datetime] = None
    status: Optional[str] = None
    public_id: Optional[UUID] = None
    actress_ids: list[int] = Field(default_factory=list)
    maker_ids: list[int] = Field(default_factory=list)
    genre_ids: list[int] = Field(default_factory=list)
    series_ids: list[int] = Field(default_factory=list)
    label_ids: list[int] = Field(default_factory=list)
    director_ids: list[int] = Field(default_factory=list)


class VideoCodeConflictDetail(BaseModel):
    """Structured 409 body when create collides on video_code."""

    code: str = "VIDEO_ID_EXISTS"
    message: str
    existing: ExistingVideoSummary


class PresignedPart(BaseModel):
    """One presigned multipart part."""

    part_number: int
    url: str


class VideoUploadCreateResponse(BaseModel):
    """Response after creating the video row and multipart session."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    public_id: UUID
    status: str
    source_key: str
    multipart_upload_id: str
    part_size_bytes: int
    part_count: int
    parts: list[PresignedPart]


class VideoUploadPartsRequest(BaseModel):
    """Request additional presigned part URLs."""

    multipart_upload_id: str = Field(min_length=1)
    part_numbers: list[int] = Field(min_length=1, max_length=10000)


class VideoUploadPartsResponse(BaseModel):
    """Batch of presigned part URLs."""

    parts: list[PresignedPart]


class CompletedPart(BaseModel):
    """ETag returned by S3 for an uploaded part."""

    part_number: int = Field(ge=1)
    etag: str = Field(min_length=1)


class VideoUploadCompleteRequest(BaseModel):
    """Complete multipart upload after all parts are stored."""

    multipart_upload_id: str = Field(min_length=1)
    parts: list[CompletedPart] = Field(min_length=1)


class VideoRenditionProgress(BaseModel):
    """Per-rung HLS encode progress for the process wizard."""

    label: str
    width: int
    height: int
    video_kbps: int
    status: str
    progress_pct: int
    attempt: int
    segment_count: Optional[int] = None
    playlist_key: Optional[str] = None


class VideoUploadStatusResponse(BaseModel):
    """Upload/processing status for a user-owned video row."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    public_id: UUID
    status: str
    original_filename: Optional[str] = None
    source_key: Optional[str] = None
    source_bytes: Optional[int] = None
    title: Optional[str] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    ready_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    overall_progress_pct: float = 0.0
    renditions: list[VideoRenditionProgress] = Field(default_factory=list)


class VideoMediaImageItem(BaseModel):
    """One catalog image row (thumbnail or sample)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    url: str
    type: Optional[str] = None


class VideoMediaResponse(BaseModel):
    """Thumbnails and sample review images for an upload."""

    public_id: UUID
    video_id: int
    thumbnails: list[VideoMediaImageItem] = Field(default_factory=list)
    samples: list[VideoMediaImageItem] = Field(default_factory=list)
