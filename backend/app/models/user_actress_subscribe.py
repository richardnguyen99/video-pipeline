"""User-to-actress subscription association.

A ``UserActressSubscribe`` row means a user is subscribed to an actress.
Lives in ``public``; ``actress_id`` is a cross-schema FK into
``public.actress``.
"""

# pylint: disable=no-member

from __future__ import annotations

import datetime
import uuid
from typing import TYPE_CHECKING, Optional

from sqlalchemy import UniqueConstraint
from sqlalchemy.sql.functions import count
from sqlalchemy.sql.functions import now as sa_now
from sqlmodel import Field, Relationship, SQLModel, col, select
from sqlmodel.ext.asyncio.session import AsyncSession

if TYPE_CHECKING:
    from app.models.actress import Actress
    from app.models.user import User


class UserActressSubscribe(SQLModel, table=True):
    """A single user's subscription to a single actress.

    Attributes:
        id: Primary key.
        user_id: The user who subscribed.
        actress_id: The subscribed actress (cross-schema FK into
            ``public.actress``).
        created_at: UTC timestamp when the subscription was created.
    """

    __tablename__ = "user_actress_subscribe"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "actress_id",
        ),
        {"schema": "public", "extend_existing": True},
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        foreign_key="public.user.id",
        index=True,
    )
    actress_id: int = Field(
        foreign_key="public.actress.id",
        index=True,
    )
    created_at: datetime.datetime = Field(
        default_factory=lambda: datetime.datetime.now(
            datetime.timezone.utc,
        ).replace(tzinfo=None),
        sa_column_kwargs={
            "server_default": sa_now(),
        },
    )

    user: User = Relationship(back_populates="actress_subscriptions")
    actress: Actress = Relationship(back_populates="subscribers")

    def __repr__(self) -> str:
        """Return a debug-friendly representation."""

        return (
            f"UserActressSubscribe(id={self.id!r}, "
            f"user_id={self.user_id!r}, actress_id={self.actress_id!r})"
        )

    @classmethod
    def create(
        cls,
        *,
        user_id: uuid.UUID,
        actress_id: int,
    ) -> "UserActressSubscribe":
        """Build a new subscription instance (does not persist it)."""

        return cls(user_id=user_id, actress_id=actress_id)

    @staticmethod
    async def get_by_user_and_actress(
        session: AsyncSession,
        *,
        user_id: uuid.UUID,
        actress_id: int,
    ) -> Optional["UserActressSubscribe"]:
        """Fetch a subscription by user and actress."""

        statement = select(UserActressSubscribe).where(
            UserActressSubscribe.user_id == user_id,
            UserActressSubscribe.actress_id == actress_id,
        )
        result = await session.exec(statement)

        return result.first()

    @staticmethod
    async def subscribe(
        session: AsyncSession,
        *,
        user_id: uuid.UUID,
        actress_id: int,
    ) -> "UserActressSubscribe":
        """Create a subscription if missing; return the existing row otherwise."""

        existing = await UserActressSubscribe.get_by_user_and_actress(
            session,
            user_id=user_id,
            actress_id=actress_id,
        )

        if existing is not None:
            return existing

        now_utc = datetime.datetime.now(datetime.timezone.utc).replace(
            tzinfo=None,
        )
        row = UserActressSubscribe.create(
            user_id=user_id,
            actress_id=actress_id,
        )
        row.created_at = now_utc
        session.add(row)
        await session.commit()
        await session.refresh(row)

        return row

    @staticmethod
    async def unsubscribe(
        session: AsyncSession,
        *,
        user_id: uuid.UUID,
        actress_id: int,
    ) -> bool:
        """Remove a subscription when present.

        Returns:
            ``True`` when a row was deleted, ``False`` when none existed.
        """

        existing = await UserActressSubscribe.get_by_user_and_actress(
            session,
            user_id=user_id,
            actress_id=actress_id,
        )

        if existing is None:
            return False

        await session.delete(existing)
        await session.commit()

        return True

    @staticmethod
    async def count_for_actress(
        session: AsyncSession,
        actress_id: int,
    ) -> int:
        """Return how many users are subscribed to an actress."""

        statement = (
            select(count())
            .select_from(UserActressSubscribe)
            .where(UserActressSubscribe.actress_id == actress_id)
        )
        result = await session.exec(statement)

        return int(result.one())

    @staticmethod
    async def count_for_user(
        session: AsyncSession,
        user_id: uuid.UUID,
    ) -> int:
        """Return how many actresses a user is subscribed to."""

        statement = (
            select(count())
            .select_from(UserActressSubscribe)
            .where(UserActressSubscribe.user_id == user_id)
        )
        result = await session.exec(statement)

        return int(result.one())

    @staticmethod
    async def list_for_user(
        session: AsyncSession,
        user_id: uuid.UUID,
        *,
        limit: int = 20,
        offset: int = 0,
    ) -> list["UserActressSubscribe"]:
        """Fetch a user's subscriptions, newest first."""

        statement = (
            select(UserActressSubscribe)
            .where(UserActressSubscribe.user_id == user_id)
            .order_by(col(UserActressSubscribe.created_at).desc())
            .limit(limit)
            .offset(offset)
        )
        result = await session.exec(statement)

        return list(result.all())
