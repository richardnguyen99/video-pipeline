"""Video view model.

Records individual view events. Lives in ``app_user_schema``. ``user_id``
is optional so anonymous views can be stored. Counts use ``COUNT(*)``.
"""

# pylint: disable=no-member

import datetime
import uuid
from typing import Optional

from sqlalchemy.sql.functions import count, now
from sqlmodel import Field, Relationship, SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.user import User
from app.models.video import Video


class VideoView(SQLModel, table=True):
    """A single view event for a video."""

    __tablename__ = "video_view"
    __table_args__ = ({"schema": "app_user_schema"},)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: Optional[uuid.UUID] = Field(
        default=None,
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

    user: Optional[User] = Relationship(back_populates="views")
    video: Video = Relationship(back_populates="views")

    def __repr__(self) -> str:
        """Return a debug-friendly representation."""

        return (
            f"VideoView(id={self.id!r}, user_id={self.user_id!r}, "
            f"video_id={self.video_id!r})"
        )

    @classmethod
    def create(
        cls,
        *,
        video_id: int,
        user_id: Optional[uuid.UUID] = None,
    ) -> "VideoView":
        """Build a new ``VideoView`` instance (does not persist it)."""

        return cls(user_id=user_id, video_id=video_id)

    @staticmethod
    async def count_for_video(session: AsyncSession, video_id: int) -> int:
        """Return the total number of view events for a video."""

        statement = select(count()).where(VideoView.video_id == video_id)
        result = await session.exec(statement)

        return int(result.one())
