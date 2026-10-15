"""Denormalized actress engagement counters (write-behind target).

Source-of-truth membership and reaction rows stay in their own tables.
This table stores pre-aggregated counts that the background worker
refreshes after Redis write-through updates.
"""

from __future__ import annotations

import datetime
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import Field, SQLModel, col, select


class ActressEngagementStats(SQLModel, table=True):
    """Cached engagement totals for one actress."""

    __tablename__ = "actress_engagement_stats"
    __table_args__ = ({"schema": "public", "extend_existing": True},)

    actress_id: int = Field(
        primary_key=True,
        foreign_key="actress.id",
    )
    video_cnt: int = Field(default=0, ge=0)
    sub_cnt: int = Field(default=0, ge=0)
    view_cnt: int = Field(default=0, ge=0)
    like_cnt: int = Field(default=0, ge=0)
    comment_cnt: int = Field(default=0, ge=0)

    updated_at: datetime.datetime = Field(
        default_factory=lambda: datetime.datetime.now(
            datetime.timezone.utc,
        ).replace(tzinfo=None),
    )

    @staticmethod
    async def get_many(
        session: AsyncSession,
        actress_ids: list[int],
    ) -> dict[int, "ActressEngagementStats"]:
        """Load stats rows keyed by actress id."""

        if not actress_ids:
            return {}

        statement = select(ActressEngagementStats).where(
            col(ActressEngagementStats.actress_id).in_(actress_ids),
        )
        result = await session.execute(statement)
        rows = result.scalars().all()

        return dict((row.actress_id, row) for row in rows)

    @staticmethod
    async def upsert(
        session: AsyncSession,
        *,
        actress_id: int,
        video_cnt: int,
        sub_cnt: int,
        view_cnt: int,
        like_cnt: int,
        comment_cnt: int,
    ) -> "ActressEngagementStats":
        """Insert or update denormalized counts for one actress."""

        now_utc = datetime.datetime.now(datetime.timezone.utc).replace(
            tzinfo=None,
        )
        existing: Optional[ActressEngagementStats] = await session.get(
            ActressEngagementStats,
            actress_id,
        )

        if existing is None:
            existing = ActressEngagementStats(
                actress_id=actress_id,
                video_cnt=video_cnt,
                sub_cnt=sub_cnt,
                view_cnt=view_cnt,
                like_cnt=like_cnt,
                comment_cnt=comment_cnt,
                updated_at=now_utc,
            )
            session.add(existing)
        else:
            existing.video_cnt = video_cnt
            existing.sub_cnt = sub_cnt
            existing.view_cnt = view_cnt
            existing.like_cnt = like_cnt
            existing.comment_cnt = comment_cnt
            existing.updated_at = now_utc
            session.add(existing)

        await session.commit()
        await session.refresh(existing)

        return existing
