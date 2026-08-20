"""Video like/dislike reaction model.

One row per user per video. ``is_like`` is a boolean for fast filtering:
``True`` = like, ``False`` = dislike. A user cannot hold both reactions
because ``(user_id, video_id)`` is unique.

Lives in ``public``. Counts are computed with ``COUNT(*)``
filtered by ``is_like``, not denormalized on ``Video``.
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


class VideoReaction(SQLModel, table=True):
    """A user's like or dislike of a single video.

    Attributes:
        id: Primary key.
        user_id: Reacting user.
        video_id: Target video (cross-schema FK into ``public.video``).
        is_like: ``True`` for like, ``False`` for dislike.
        created_at: When the reaction was created or last set.
    """

    __tablename__ = "video_reaction"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "video_id",
            name="uq_video_reaction_user_video",
        ),
        {"schema": "public"},
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        foreign_key="public.user.id",
        index=True,
    )
    video_id: int = Field(foreign_key="public.video.id", index=True)
    is_like: bool = Field(index=True)
    created_at: datetime.datetime = Field(
        default_factory=now,
        sa_column_kwargs={
            "server_default": now(),
        },
    )

    user: User = Relationship(back_populates="video_reactions")
    video: Video = Relationship(back_populates="reactions")

    def __repr__(self) -> str:
        """Return a debug-friendly representation."""

        return (
            f"VideoReaction(id={self.id!r}, user_id={self.user_id!r}, "
            f"video_id={self.video_id!r}, is_like={self.is_like!r})"
        )

    @classmethod
    def create(
        cls,
        *,
        user_id: uuid.UUID,
        video_id: int,
        is_like: bool,
    ) -> "VideoReaction":
        """Build a new reaction instance (does not persist it)."""

        return cls(user_id=user_id, video_id=video_id, is_like=is_like)

    @staticmethod
    async def get_by_user_and_video(
        session: AsyncSession,
        user_id: uuid.UUID,
        video_id: int,
    ) -> Optional["VideoReaction"]:
        """Fetch the reaction for a user/video pair, if any."""

        statement = select(VideoReaction).where(
            VideoReaction.user_id == user_id,
            VideoReaction.video_id == video_id,
        )
        result = await session.exec(statement)

        return result.first()

    @staticmethod
    async def count_likes_for_video(
        session: AsyncSession,
        video_id: int,
    ) -> int:
        """Return the number of likes for a video."""

        statement = (
            select(count())
            .select_from(VideoReaction)
            .where(
                VideoReaction.video_id == video_id,
                col(VideoReaction.is_like).is_(True),
            )
        )
        result = await session.exec(statement)

        return int(result.one())

    @staticmethod
    async def count_dislikes_for_video(
        session: AsyncSession,
        video_id: int,
    ) -> int:
        """Return the number of dislikes for a video."""

        statement = (
            select(count())
            .select_from(VideoReaction)
            .where(
                VideoReaction.video_id == video_id,
                col(VideoReaction.is_like).is_(False),
            )
        )
        result = await session.exec(statement)

        return int(result.one())

    @staticmethod
    async def list_liked_by_user(
        session: AsyncSession,
        user_id: uuid.UUID,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> list["VideoReaction"]:
        """Fetch a user's likes, newest first (watch-later list)."""

        statement = (
            select(VideoReaction)
            .where(
                VideoReaction.user_id == user_id,
                col(VideoReaction.is_like).is_(True),
            )
            .order_by(col(VideoReaction.created_at).desc())
            .limit(limit)
            .offset(offset)
        )
        result = await session.exec(statement)

        return list(result.all())

    @staticmethod
    async def clear(
        session: AsyncSession,
        user_id: uuid.UUID,
        video_id: int,
    ) -> bool:
        """Remove a reaction if it exists.

        Returns:
            True if a row was deleted, False otherwise.
        """

        reaction = await VideoReaction.get_by_user_and_video(
            session,
            user_id,
            video_id,
        )

        if reaction is None:
            return False

        await session.delete(reaction)
        await session.commit()

        return True
