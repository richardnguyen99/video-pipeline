"""Per-user video watch progress and repeated-watch counts.

Tracks the latest playback position (for seek / resume) and how many
times the authenticated user has started a watch on a given video.
Global view counts are aggregated from ``user_watch_history``.
"""

from __future__ import annotations

import datetime
import uuid
from typing import Optional

from sqlalchemy import UniqueConstraint
from sqlalchemy.exc import IntegrityError
from sqlalchemy.sql.functions import now
from sqlmodel import Field, Relationship, SQLModel, col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.user import User
from app.models.video import Video


class VideoWatchProgress(SQLModel, table=True):
    """Latest watch position and repeat count for one user on one video."""

    __tablename__ = "video_watch_progress"
    __table_args__ = (
        UniqueConstraint("user_id", "video_id"),
        {"schema": "public"},
    )

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
    )
    user_id: uuid.UUID = Field(
        foreign_key="public.user.id",
        index=True,
    )
    video_id: int = Field(
        foreign_key="public.video.id",
        index=True,
    )
    position_seconds: float = Field(
        default=0.0,
        ge=0,
    )
    watch_count: int = Field(
        default=0,
        ge=0,
    )
    last_watched_at: datetime.datetime = Field(default_factory=now)
    updated_at: datetime.datetime = Field(default_factory=now)

    user: User = Relationship()
    video: Video = Relationship()

    def __repr__(self) -> str:
        """Return a debug-friendly representation."""

        return (
            f"VideoWatchProgress(user_id={self.user_id!r}, "
            f"video_id={self.video_id!r}, "
            f"position_seconds={self.position_seconds!r}, "
            f"watch_count={self.watch_count!r})"
        )

    @classmethod
    def create(
        cls,
        *,
        user_id: uuid.UUID,
        video_id: int,
        position_seconds: float = 0.0,
        watch_count: int = 1,
    ) -> "VideoWatchProgress":
        """Build a new progress row (does not persist it)."""

        return cls(
            user_id=user_id,
            video_id=video_id,
            position_seconds=max(0.0, position_seconds),
            watch_count=max(0, watch_count),
        )

    @staticmethod
    async def get_for_user_video(
        session: AsyncSession,
        *,
        user_id: uuid.UUID,
        video_id: int,
        for_update: bool = False,
    ) -> Optional["VideoWatchProgress"]:
        """Return progress for a user/video pair, if any.

        Args:
            session: Active async session.
            user_id: Authenticated user.
            video_id: Target video primary key.
            for_update: When True, row-level lock the selected row.

        Returns:
            The matching row or ``None``.
        """

        statement = select(VideoWatchProgress).where(
            col(VideoWatchProgress.user_id) == user_id,
            col(VideoWatchProgress.video_id) == video_id,
        )

        if for_update:
            statement = statement.with_for_update()

        result = await session.exec(statement)

        return result.first()

    @staticmethod
    async def list_for_user(
        session: AsyncSession,
        *,
        user_id: uuid.UUID,
        limit: int = 20,
        offset: int = 0,
    ) -> list["VideoWatchProgress"]:
        """Return a user's watch progress rows, most recently watched first."""

        statement = (
            select(VideoWatchProgress)
            .where(col(VideoWatchProgress.user_id) == user_id)
            .order_by(col(VideoWatchProgress.last_watched_at).desc())
            .offset(offset)
            .limit(limit)
        )
        result = await session.exec(statement)

        return list(result.all())

    @staticmethod
    async def upsert_progress(
        session: AsyncSession,
        *,
        user_id: uuid.UUID,
        video_id: int,
        position_seconds: float,
        increment_watch: bool = False,
    ) -> "VideoWatchProgress":
        """Create or update progress; optionally bump the repeated-watch count.

        Args:
            session: Active async session.
            user_id: Authenticated user.
            video_id: Target video primary key.
            position_seconds: Playback position in seconds (>= 0).
            increment_watch: When True, treat this as a new watch session
                and increment ``watch_count``.

        Returns:
            The persisted progress row.
        """

        position = max(0.0, float(position_seconds))
        now_utc = datetime.datetime.now(datetime.timezone.utc).replace(
            tzinfo=None,
        )

        for attempt in range(2):
            row = await VideoWatchProgress.get_for_user_video(
                session,
                user_id=user_id,
                video_id=video_id,
                for_update=True,
            )

            if row is None:
                row = VideoWatchProgress.create(
                    user_id=user_id,
                    video_id=video_id,
                    position_seconds=position,
                    watch_count=1 if increment_watch else 0,
                )
                row.last_watched_at = now_utc
                row.updated_at = now_utc
                session.add(row)
            else:
                row.position_seconds = position
                row.updated_at = now_utc
                row.last_watched_at = now_utc

                if increment_watch:
                    row.watch_count = int(row.watch_count) + 1

                session.add(row)

            try:
                await session.commit()
            except IntegrityError:
                await session.rollback()

                if attempt == 0:
                    continue

                raise

            await session.refresh(row)

            return row

        raise RuntimeError(
            "Failed to upsert video watch progress after retry.",
        )
