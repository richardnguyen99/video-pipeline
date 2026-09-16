"""Pre-computed video-to-video recommendation rows."""

from sqlalchemy import Index, UniqueConstraint
from sqlmodel import Field

from app.models.base import IdTimestampMixin


class VideoRecommendation(IdTimestampMixin, table=True):
    """Ranked recommendation of one video for another.

    Populated offline by the recommendation compute job. The API reads
    these rows instead of running the similarity query per request.
    """

    __tablename__ = "video_recommendation"
    __table_args__ = (
        UniqueConstraint("video_id", "recommended_video_id"),
        Index(None, "video_id", "rank"),
        {"schema": "public"},
    )

    video_id: int = Field(
        foreign_key="public.video.id",
        index=True,
        nullable=False,
    )
    recommended_video_id: int = Field(
        foreign_key="public.video.id",
        index=True,
        nullable=False,
    )
    rank: int = Field(
        nullable=False,
        ge=1,
    )
    score: float = Field(
        default=0.0,
        nullable=False,
    )
