"""Per-user privacy controls for public profile activity visibility."""

from __future__ import annotations

import datetime
import uuid
from typing import Optional

from sqlalchemy.sql.functions import now as sa_now
from sqlmodel import Field, SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession


class UserPrivacySettings(SQLModel, table=True):
    """Visibility toggles for activity shown on a user's public profile.

    One row per user. Missing rows are treated as defaults by the service
    layer (watched/liked private, subscriptions and comments public).
    """

    __tablename__ = "user_privacy_settings"
    __table_args__ = {"schema": "public", "extend_existing": True}

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        foreign_key="user.id",
        unique=True,
        index=True,
    )
    show_watched_videos: bool = Field(default=False)
    show_liked_videos: bool = Field(default=False)
    show_subscriptions: bool = Field(default=True)
    show_comment_history: bool = Field(default=True)
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

        return f"UserPrivacySettings(id={self.id!r}, user_id={self.user_id!r})"

    @staticmethod
    async def get_by_user_id(
        session: AsyncSession,
        *,
        user_id: uuid.UUID,
    ) -> Optional["UserPrivacySettings"]:
        """Fetch privacy settings for a user, or ``None``."""

        statement = select(UserPrivacySettings).where(
            UserPrivacySettings.user_id == user_id,
        )
        result = await session.exec(statement)

        return result.first()
