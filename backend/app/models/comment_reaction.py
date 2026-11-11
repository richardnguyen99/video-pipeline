"""Comment like/dislike reaction model.

One row per user per comment. ``is_like`` is a boolean:
``True`` = like, ``False`` = dislike. ``(user_id, comment_id)`` is unique.
"""

# pylint: disable=no-member

import datetime
import uuid
from typing import Optional

from sqlalchemy import UniqueConstraint
from sqlalchemy.sql.functions import count, now
from sqlmodel import Field, SQLModel, col, select
from sqlmodel.ext.asyncio.session import AsyncSession


class CommentReaction(SQLModel, table=True):
    """A user's like or dislike of a single comment."""

    __tablename__ = "comment_reaction"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "comment_id",
        ),
        {"schema": "public", "extend_existing": True},
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        foreign_key="user.id",
        index=True,
    )
    comment_id: uuid.UUID = Field(
        foreign_key="comment.id",
        index=True,
    )
    is_like: bool = Field(index=True)
    created_at: datetime.datetime = Field(
        default_factory=now,
        sa_column_kwargs={
            "server_default": now(),
        },
    )

    def __repr__(self) -> str:
        """Return a debug-friendly representation."""

        return (
            f"CommentReaction(id={self.id!r}, user_id={self.user_id!r}, "
            f"comment_id={self.comment_id!r}, is_like={self.is_like!r})"
        )

    @classmethod
    def create(
        cls,
        *,
        user_id: uuid.UUID,
        comment_id: uuid.UUID,
        is_like: bool,
    ) -> "CommentReaction":
        """Build a new reaction instance (does not persist it)."""

        return cls(user_id=user_id, comment_id=comment_id, is_like=is_like)

    @staticmethod
    async def get_by_user_and_comment(
        session: AsyncSession,
        user_id: uuid.UUID,
        comment_id: uuid.UUID,
    ) -> Optional["CommentReaction"]:
        """Fetch the reaction for a user/comment pair, if any."""

        statement = select(CommentReaction).where(
            CommentReaction.user_id == user_id,
            CommentReaction.comment_id == comment_id,
        )
        result = await session.exec(statement)

        return result.first()

    @staticmethod
    async def set(
        session: AsyncSession,
        *,
        user_id: uuid.UUID,
        comment_id: uuid.UUID,
        is_like: bool,
        commit: bool = True,
    ) -> "CommentReaction":
        """Create or update the reaction for a user/comment pair."""

        reaction = await CommentReaction.get_by_user_and_comment(
            session,
            user_id,
            comment_id,
        )

        if reaction is None:
            reaction = CommentReaction.create(
                user_id=user_id,
                comment_id=comment_id,
                is_like=is_like,
            )
            session.add(reaction)
        else:
            reaction.is_like = is_like

        if commit:
            await session.commit()
            await session.refresh(reaction)
        else:
            await session.flush()

        return reaction

    @staticmethod
    async def clear(
        session: AsyncSession,
        *,
        user_id: uuid.UUID,
        comment_id: uuid.UUID,
        commit: bool = True,
    ) -> None:
        """Remove the reaction for a user/comment pair if present."""

        reaction = await CommentReaction.get_by_user_and_comment(
            session,
            user_id,
            comment_id,
        )

        if reaction is None:
            return

        await session.delete(reaction)

        if commit:
            await session.commit()

    @staticmethod
    async def counts_for_comments(
        session: AsyncSession,
        comment_ids: list[uuid.UUID],
    ) -> dict[uuid.UUID, tuple[int, int]]:
        """Return ``(likes, dislikes)`` counts keyed by comment id."""

        if not comment_ids:
            return {}

        statement = (
            select(
                CommentReaction.comment_id,
                CommentReaction.is_like,
                count(),
            )
            .where(col(CommentReaction.comment_id).in_(comment_ids))
            .group_by(
                col(CommentReaction.comment_id), col(CommentReaction.is_like)
            )
        )
        result = await session.exec(statement)
        totals: dict[uuid.UUID, tuple[int, int]] = {
            comment_id: (0, 0) for comment_id in comment_ids
        }

        for comment_id, is_like, total in result.all():
            likes, dislikes = totals.get(comment_id, (0, 0))
            count_value = int(total)

            if is_like:
                totals[comment_id] = (count_value, dislikes)
            else:
                totals[comment_id] = (likes, count_value)

        return totals

    @staticmethod
    async def viewer_votes_for_comments(
        session: AsyncSession,
        *,
        user_id: uuid.UUID,
        comment_ids: list[uuid.UUID],
    ) -> dict[uuid.UUID, bool]:
        """Return ``is_like`` keyed by comment id for the viewer."""

        if not comment_ids:
            return {}

        statement = select(CommentReaction).where(
            col(CommentReaction.user_id) == user_id,
            col(CommentReaction.comment_id).in_(comment_ids),
        )
        result = await session.exec(statement)

        return {row.comment_id: bool(row.is_like) for row in result.all()}
