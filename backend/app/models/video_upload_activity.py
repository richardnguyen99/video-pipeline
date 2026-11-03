"""Append-only activity log for studio video uploads."""

from __future__ import annotations

import datetime
import uuid
from enum import Enum
from typing import Any, Optional

from sqlalchemy import Column, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql.functions import now
from sqlmodel import Field, SQLModel
from sqlmodel.sql.sqltypes import AutoString


class VideoUploadActivityType(str, Enum):
    """Event kinds recorded on an upload's activity timeline."""

    UPLOAD_CREATED = "upload_created"
    UPLOAD_COMPLETED = "upload_completed"
    STREAM_ENCODING_STARTED = "stream_encoding_started"
    STREAM_READY = "stream_ready"
    STREAM_REBUILT = "stream_rebuilt"
    RENDITION_RECOVERED = "rendition_recovered"
    METADATA_UPDATED = "metadata_updated"
    ACCESS_UPDATED = "access_updated"
    THUMBNAIL_UPLOADED = "thumbnail_uploaded"
    THUMBNAIL_LINKED = "thumbnail_linked"
    THUMBNAIL_DELETED = "thumbnail_deleted"
    SAMPLE_UPLOADED = "sample_uploaded"
    SAMPLE_LINKED = "sample_linked"
    SAMPLE_DELETED = "sample_deleted"


class VideoUploadActivity(SQLModel, table=True):
    """One recorded studio action against an upload."""

    __tablename__ = "video_upload_activity"
    __table_args__ = (
        Index(
            None,
            "video_id",
            "created_at",
        ),
        Index(
            None,
            "public_id",
            "created_at",
        ),
        {"schema": "public"},
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    video_id: int = Field(index=True)
    public_id: uuid.UUID = Field(index=True)
    actor_id: Optional[uuid.UUID] = Field(default=None, index=True)
    event_type: str = Field(
        max_length=64,
        sa_type=AutoString,
        index=True,
    )
    message: str = Field(
        max_length=512,
        sa_type=AutoString,
    )
    metadata_: Optional[dict[str, Any]] = Field(
        default=None,
        sa_column=Column("metadata", JSONB, nullable=True),
    )
    created_at: datetime.datetime = Field(
        default_factory=now,
        sa_column_kwargs={"server_default": now()},
    )

    def __repr__(self) -> str:
        """Return a debug-friendly representation."""

        return (
            f"VideoUploadActivity(id={self.id!r}, video_id={self.video_id!r}, "
            f"event_type={self.event_type!r})"
        )
