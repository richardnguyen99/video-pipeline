"""User comment model for videos.

Comments are owned by ``app_user`` (created in ``app_user_schema``)
but reference a row in the read-only ``public.video`` table via a
cross-schema foreign key.
"""

# pylint: disable=no-member

import datetime
import uuid

from app.models.user import User
from app.models.video import Video
from sqlalchemy.sql.functions import now
from sqlmodel import Field, Relationship, SQLModel, col, select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel.sql.sqltypes import AutoString


class Comment(SQLModel, table=True):
    """A user's comment on a video.

    Attributes:
        id: Primary key.
        user_id: Author of the comment.
        video_id: Commented-on video (cross-schema FK into
            ``public.video``).
        content: Comment body text.
        is_edited: Set true the first time the comment is edited.
        is_deleted: Soft-delete flag; keeps the row (and any reply
            thread) intact while hiding content.
        created_at: UTC timestamp set on creation.
        updated_at: UTC timestamp updated on every write.
    """

    __tablename__ = "comment"
    __table_args__ = {"schema": "app_user_schema"}

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        foreign_key="app_user_schema.user.id",
        index=True,
    )
    video_id: int = Field(foreign_key="public.video.id", index=True)

    content: str = Field(sa_type=AutoString, nullable=False)

    is_edited: bool = Field(default=False)
    is_deleted: bool = Field(default=False)

    created_at: datetime.datetime = Field(
        default_factory=now,
        sa_column_kwargs={
            "server_default": now(),
        },
    )
    updated_at: datetime.datetime = Field(
        default_factory=now,
        sa_column_kwargs={
            "server_default": now(),
        },
    )

    user: User = Relationship(back_populates="comments")
    video: Video = Relationship(back_populates="comments")

    def __repr__(self) -> str:
        """Return a debug-friendly representation."""

        return (
            f"Comment(id={self.id!r}, user_id={self.user_id!r}, "
            f"video_id={self.video_id!r})"
        )

    @classmethod
    def create(
        cls,
        *,
        user_id: uuid.UUID,
        video_id: int,
        content: str,
        **kwargs,
    ) -> "Comment":
        """Build a new ``Comment`` instance (does not persist it)."""

        return cls(
            user_id=user_id,
            video_id=video_id,
            content=content,
            **kwargs,
        )

    @staticmethod
    async def get_by_video_id(
        session: AsyncSession,
        video_id: int,
        *,
        include_deleted: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> list["Comment"]:
        """Fetch comments for a video, newest first."""

        statement = select(Comment).where(Comment.video_id == video_id)

        if not include_deleted:
            statement = statement.where(
                col(Comment.is_deleted).is_(False),
            )

        statement = (
            statement.order_by(
                col(Comment.created_at).desc(),
            )
            .limit(limit)
            .offset(offset)
        )

        result = await session.exec(statement)

        return list(result.all())

    @staticmethod
    async def get_by_user_id(
        session: AsyncSession,
        user_id: uuid.UUID,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> list["Comment"]:
        """Fetch a user's comments, newest first."""

        statement = (
            select(Comment)
            .where(Comment.user_id == user_id)
            .order_by(col(Comment.created_at).desc())
            .limit(limit)
            .offset(offset)
        )

        result = await session.exec(statement)

        return list(result.all())
