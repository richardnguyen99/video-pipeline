"""User-to-user block association.

A ``UserBlockedAccount`` row means ``blocker_id`` has blocked ``blocked_id``.
"""

from __future__ import annotations

import datetime
import uuid
from typing import Optional

from sqlalchemy import UniqueConstraint
from sqlalchemy.sql.functions import now as sa_now
from sqlmodel import Field, SQLModel, col, select
from sqlmodel.ext.asyncio.session import AsyncSession


class UserBlockedAccount(SQLModel, table=True):
    """A single block relationship between two users.

    Attributes:
        id: Primary key.
        blocker_id: The user who initiated the block.
        blocked_id: The user who is blocked.
        created_at: UTC timestamp when the block was created.
    """

    __tablename__ = "user_blocked_account"
    __table_args__ = (
        UniqueConstraint(
            "blocker_id",
            "blocked_id",
        ),
        {"schema": "public", "extend_existing": True},
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    blocker_id: uuid.UUID = Field(
        foreign_key="user.id",
        index=True,
    )
    blocked_id: uuid.UUID = Field(
        foreign_key="user.id",
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

    def __repr__(self) -> str:
        """Return a debug-friendly representation."""

        return (
            f"UserBlockedAccount(id={self.id!r}, "
            f"blocker_id={self.blocker_id!r}, "
            f"blocked_id={self.blocked_id!r})"
        )

    @classmethod
    def create(
        cls,
        *,
        blocker_id: uuid.UUID,
        blocked_id: uuid.UUID,
    ) -> "UserBlockedAccount":
        """Build a new block instance (does not persist it)."""

        return cls(blocker_id=blocker_id, blocked_id=blocked_id)

    @staticmethod
    async def get_by_blocker_and_blocked(
        session: AsyncSession,
        *,
        blocker_id: uuid.UUID,
        blocked_id: uuid.UUID,
    ) -> Optional["UserBlockedAccount"]:
        """Fetch a block by blocker and blocked user."""

        statement = select(UserBlockedAccount).where(
            UserBlockedAccount.blocker_id == blocker_id,
            UserBlockedAccount.blocked_id == blocked_id,
        )
        result = await session.exec(statement)

        return result.first()

    @staticmethod
    async def list_by_blocker(
        session: AsyncSession,
        *,
        blocker_id: uuid.UUID,
    ) -> list["UserBlockedAccount"]:
        """List all blocks created by a user, newest first."""

        statement = (
            select(UserBlockedAccount)
            .where(UserBlockedAccount.blocker_id == blocker_id)
            .order_by(col(UserBlockedAccount.created_at).desc())
        )
        result = await session.exec(statement)

        return list(result.all())
