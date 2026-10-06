"""Tier-2 per-user watch state (upsert).

Stores the latest seek position and how many countable views the user has
accrued for a video after the eligible-watch threshold is met.
"""

from __future__ import annotations

import datetime
import uuid
from typing import Optional

from sqlalchemy import UniqueConstraint, func
from sqlalchemy.sql.functions import now
from sqlmodel import Field, SQLModel, col, select
from sqlmodel.ext.asyncio.session import AsyncSession


class UserWatchHistory(SQLModel, table=True):
    """Per-user watch history and resume position for one video."""

    __tablename__ = "user_watch_history"
    __table_args__ = (
        UniqueConstraint("user_id", "video_id"),
        {"schema": "public"},
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="public.user.id", index=True)
    video_id: int = Field(foreign_key="public.video.id", index=True)
    position_seconds: float = Field(default=0.0, ge=0)
    total_view_count: int = Field(default=0, ge=0)
    last_watched_at: datetime.datetime = Field(default_factory=now)
    updated_at: datetime.datetime = Field(default_factory=now)

    @classmethod
    def create(
        cls,
        *,
        user_id: uuid.UUID,
        video_id: int,
        position_seconds: float = 0.0,
        total_view_count: int = 0,
    ) -> "UserWatchHistory":
        """Build a new history row (does not persist it)."""

        return cls(
            user_id=user_id,
            video_id=video_id,
            position_seconds=max(0.0, float(position_seconds)),
            total_view_count=max(0, int(total_view_count)),
        )

    @staticmethod
    async def get_for_user_video(
        session: AsyncSession,
        *,
        user_id: uuid.UUID,
        video_id: int,
    ) -> Optional["UserWatchHistory"]:
        """Return history for a user/video pair, if any."""

        statement = select(UserWatchHistory).where(
            col(UserWatchHistory.user_id) == user_id,
            col(UserWatchHistory.video_id) == video_id,
        )
        result = await session.exec(statement)

        return result.first()

    @staticmethod
    async def list_for_user(
        session: AsyncSession,
        *,
        user_id: uuid.UUID,
        limit: int = 20,
        offset: int = 0,
    ) -> list["UserWatchHistory"]:
        """Return history rows newest first."""

        statement = (
            select(UserWatchHistory)
            .where(col(UserWatchHistory.user_id) == user_id)
            .order_by(col(UserWatchHistory.last_watched_at).desc())
            .offset(offset)
            .limit(limit)
        )
        result = await session.exec(statement)

        return list(result.all())

    @staticmethod
    async def count_for_user(
        session: AsyncSession,
        *,
        user_id: uuid.UUID,
    ) -> int:
        """Return the number of watch-history rows for a user."""

        statement = (
            select(func.count())
            .select_from(UserWatchHistory)
            .where(col(UserWatchHistory.user_id) == user_id)
        )
        result = await session.exec(statement)
        value = result.one()

        return int(value)

    @staticmethod
    async def upsert(
        session: AsyncSession,
        *,
        user_id: uuid.UUID,
        video_id: int,
        position_seconds: float,
        increment_view: bool = False,
    ) -> "UserWatchHistory":
        """Create or update history; optionally increment countable views."""

        position = max(0.0, float(position_seconds))
        now_utc = datetime.datetime.now(datetime.timezone.utc).replace(
            tzinfo=None,
        )

        row = await UserWatchHistory.get_for_user_video(
            session,
            user_id=user_id,
            video_id=video_id,
        )

        if row is None:
            row = UserWatchHistory.create(
                user_id=user_id,
                video_id=video_id,
                position_seconds=position,
                total_view_count=1 if increment_view else 0,
            )
            row.last_watched_at = now_utc
            row.updated_at = now_utc
            session.add(row)
        else:
            row.position_seconds = position
            row.updated_at = now_utc
            row.last_watched_at = now_utc

            if increment_view:
                row.total_view_count = int(row.total_view_count) + 1

            session.add(row)

        await session.commit()
        await session.refresh(row)

        return row

    @staticmethod
    async def delete_for_user_video(
        session: AsyncSession,
        *,
        user_id: uuid.UUID,
        video_id: int,
    ) -> bool:
        """Delete history for a user/video pair. Returns True if a row was removed."""

        row = await UserWatchHistory.get_for_user_video(
            session,
            user_id=user_id,
            video_id=video_id,
        )

        if row is None:
            return False

        await session.delete(row)
        await session.commit()

        return True
