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
from sqlalchemy.sql.functions import now
from sqlmodel import Field, Relationship, SQLModel, select
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
            name="uq_user_actress_subscribe_user_actress",
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
        default_factory=now,
        sa_column_kwargs={
            "server_default": now(),
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
