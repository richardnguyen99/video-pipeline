"""Per-user notification preferences and preferred language."""

from __future__ import annotations

import datetime
import uuid
from typing import Optional

from sqlalchemy.sql.functions import now as sa_now
from sqlmodel import Field, SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel.sql.sqltypes import AutoString


class UserNotificationSettings(SQLModel, table=True):
    """Notification toggles and preferred language for a single user.

    One row per user. Missing rows are treated as defaults by the service
    layer (all activity notifications on, language ``en``).
    """

    __tablename__ = "user_notification_settings"
    __table_args__ = {"schema": "public", "extend_existing": True}

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        foreign_key="user.id",
        unique=True,
        index=True,
    )
    preferred_language: str = Field(
        default="en",
        max_length=16,
        sa_type=AutoString,
    )
    notify_followed_videos: bool = Field(default=True)
    notify_public_video_activity: bool = Field(default=True)
    notify_public_playlist_activity: bool = Field(default=True)
    notify_comment_replies: bool = Field(default=True)
    created_at: datetime.datetime = Field(
        default_factory=lambda: datetime.datetime.now(
            datetime.timezone.utc,
        ).replace(tzinfo=None),
        sa_column_kwargs={
            "server_default": sa_now(),
        },
    )
    updated_at: datetime.datetime = Field(
        default_factory=lambda: datetime.datetime.now(
            datetime.timezone.utc,
        ).replace(tzinfo=None),
        sa_column_kwargs={
            "server_default": sa_now(),
            "onupdate": sa_now(),
        },
    )

    def __repr__(self) -> str:
        """Return a debug-friendly representation."""

        return (
            f"UserNotificationSettings(id={self.id!r}, "
            f"user_id={self.user_id!r}, "
            f"preferred_language={self.preferred_language!r})"
        )

    @staticmethod
    async def get_by_user_id(
        session: AsyncSession,
        *,
        user_id: uuid.UUID,
    ) -> Optional["UserNotificationSettings"]:
        """Fetch notification settings for a user, or ``None``."""

        statement = select(UserNotificationSettings).where(
            UserNotificationSettings.user_id == user_id,
        )
        result = await session.exec(statement)

        return result.first()
