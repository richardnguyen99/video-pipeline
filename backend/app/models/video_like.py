"""Video like / watch-later model.

A ``VideoLike`` row means "this user liked this video" and doubles as
their watch-later list (query a user's likes, newest first, to get
that list). Lives in ``app_user_schema`` since ``app_user`` owns it;
``video_id`` is a cross-schema FK into the read-only ``public.video``
table.

Like counts are *not* stored on ``Video`` itself — ``app_user`` only
has SELECT on ``public.video`` and can't ALTER it to add a column.
``VideoLike.count_for_video()`` below computes the count on demand via
``COUNT(*)``, which is correct-by-construction and fine for most
traffic levels. See the bottom of this file for an optional
denormalized-counter variant if you outgrow that.
"""

# pylint: disable=no-member

import datetime
import uuid
from typing import Optional

from sqlalchemy import UniqueConstraint
from sqlalchemy.sql.functions import count, now
from sqlmodel import Field, Relationship, SQLModel, col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.user import User
from app.models.video import Video


class VideoLike(SQLModel, table=True):
    """A single user's like of a single video.

    Attributes:
        id: Primary key.
        user_id: The user who liked the video.
        video_id: The liked video (cross-schema FK into
            ``public.video``).
        created_at: UTC timestamp when the like was created.
    """

    __tablename__ = "video_like"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "video_id",
            name="uq_video_like_user_video",
        ),
        {"schema": "app_user_schema"},
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        foreign_key="app_user_schema.user.id",
        index=True,
    )
    video_id: int = Field(foreign_key="public.video.id", index=True)

    created_at: datetime.datetime = Field(
        default_factory=now,
        sa_column_kwargs={
            "server_default": now(),
        },
    )

    user: User = Relationship(back_populates="likes")
    video: Video = Relationship(back_populates="likes")

    def __repr__(self) -> str:
        """Return a debug-friendly representation."""

        return (
            f"VideoLike(id={self.id!r}, user_id={self.user_id!r}, "
            f"video_id={self.video_id!r})"
        )

    @classmethod
    def create(cls, *, user_id: uuid.UUID, video_id: int) -> "VideoLike":
        """Build a new ``VideoLike`` instance (does not persist it)."""

        return cls(user_id=user_id, video_id=video_id)

    @staticmethod
    async def get_by_user_and_video(
        session: AsyncSession,
        user_id: uuid.UUID,
        video_id: int,
    ) -> Optional["VideoLike"]:
        """Fetch a single like, if it exists.

        Useful for checking "has this user already liked this video"
        before insert, or for finding the row to delete on unlike.
        """

        statement = select(VideoLike).where(
            VideoLike.user_id == user_id, VideoLike.video_id == video_id
        )
        result = await session.exec(statement)
        return result.first()

    @staticmethod
    async def count_for_video(session: AsyncSession, video_id: int) -> int:
        """Return the total number of likes for a video."""

        statement = (
            select(count())
            .select_from(VideoLike)
            .where(
                VideoLike.video_id == video_id,
            )
        )
        result = await session.exec(statement)

        return result.one()

    @staticmethod
    async def get_liked_videos_for_user(
        session: AsyncSession,
        user_id: uuid.UUID,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> list["VideoLike"]:
        """Fetch a user's liked videos, newest first (watch-later list)."""

        statement = (
            select(VideoLike)
            .where(VideoLike.user_id == user_id)
            .order_by(
                col(VideoLike.created_at).desc(),
            )
            .limit(limit)
            .offset(offset)
        )

        result = await session.exec(statement)

        return list(result.all())

    @staticmethod
    async def unlike(
        session: AsyncSession,
        user_id: uuid.UUID,
        video_id: int,
    ) -> bool:
        """Remove a like if it exists.

        Returns:
            True if a row was deleted, False if there was nothing to
            remove.
        """

        like = await VideoLike.get_by_user_and_video(
            session,
            user_id,
            video_id,
        )

        if like is None:
            return False

        await session.delete(like)
        await session.commit()

        return True
