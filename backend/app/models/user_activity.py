"""Append-only user activity / security audit log."""

from __future__ import annotations

import datetime
import uuid
from enum import Enum
from typing import Any, Optional

from sqlalchemy import Column, Index, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql.functions import now
from sqlmodel import Field, SQLModel, col, select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel.sql.sqltypes import AutoString


class UserActivityType(str, Enum):
    """Supported activity event kinds shown on the security history page."""

    USER_CREATE = "user_create"
    LOGIN = "login"
    PASSWORD_CHANGE = "password_change"
    USERNAME_CHANGE = "username_change"
    EMAIL_CHANGE = "email_change"
    LIKE = "like"
    DISLIKE = "dislike"
    COMMENT = "comment"
    PLAYLIST_CREATE = "playlist_create"
    ACTRESS_SUBSCRIBE = "actress_subscribe"
    ACTRESS_UNSUBSCRIBE = "actress_unsubscribe"


class UserActivity(SQLModel, table=True):
    """One recorded account or content action for a user.

    Rows are append-only. ``metadata_`` holds optional references
    (video id/title, playlist id/name, old/new username, etc.).
    """

    __tablename__ = "user_activity"
    __table_args__ = (
        Index("ix_user_activity_user_id_created_at", "user_id", "created_at"),
        {"schema": "public"},
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        foreign_key="public.user.id",
        index=True,
    )
    event_type: str = Field(
        max_length=64,
        sa_type=AutoString,
        index=True,
    )
    metadata_: Optional[dict[str, Any]] = Field(
        default=None,
        sa_column=Column("metadata", JSONB, nullable=True),
    )
    ip_address: Optional[str] = Field(
        default=None,
        max_length=45,
        sa_type=AutoString,
    )
    user_agent: Optional[str] = Field(
        default=None,
        max_length=255,
        sa_type=AutoString,
    )
    created_at: datetime.datetime = Field(
        default_factory=now,
        sa_column_kwargs={"server_default": now()},
    )

    def __repr__(self) -> str:
        """Return a debug-friendly representation."""

        return (
            f"UserActivity(id={self.id!r}, user_id={self.user_id!r}, "
            f"event_type={self.event_type!r})"
        )

    @classmethod
    async def record(
        cls,
        session: AsyncSession,
        *,
        user_id: uuid.UUID,
        event_type: UserActivityType | str,
        metadata: Optional[dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        commit: bool = False,
    ) -> UserActivity:
        """Insert one activity row.

        Args:
            session: Bound async session.
            user_id: Acting user.
            event_type: Event kind (enum or string value).
            metadata: Optional structured references for the UI.
            ip_address: Client IP when known.
            user_agent: Truncated user-agent when known.
            commit: When True, commit after add; otherwise rely on caller.

        Returns:
            The persisted (or pending) activity instance.
        """

        kind = (
            event_type.value
            if isinstance(event_type, UserActivityType)
            else str(event_type)
        )
        row = cls(
            user_id=user_id,
            event_type=kind,
            metadata_=metadata,
            ip_address=ip_address,
            user_agent=(user_agent[:255] if user_agent is not None else None),
        )
        session.add(row)

        if commit:
            await session.commit()
            await session.refresh(row)
        else:
            await session.flush()

        return row

    @staticmethod
    async def list_for_user(
        session: AsyncSession,
        user_id: uuid.UUID,
        *,
        limit: int = 50,
        offset: int = 0,
        event_types: Optional[list[str]] = None,
    ) -> list[UserActivity]:
        """Return activity rows for a user, newest first."""

        safe_limit = max(1, min(limit, 100))
        safe_offset = max(0, offset)
        statement = (
            select(UserActivity)
            .where(col(UserActivity.user_id) == user_id)
            .order_by(col(UserActivity.created_at).desc())
            .limit(safe_limit)
            .offset(safe_offset)
        )

        if event_types:
            statement = statement.where(
                col(UserActivity.event_type).in_(event_types),
            )

        result = await session.exec(statement)

        return list(result.all())

    @staticmethod
    async def count_for_user(
        session: AsyncSession,
        user_id: uuid.UUID,
        *,
        event_types: Optional[list[str]] = None,
    ) -> int:
        """Return how many activity rows exist for a user."""

        statement = (
            select(func.count())
            .select_from(UserActivity)
            .where(col(UserActivity.user_id) == user_id)
        )

        if event_types:
            statement = statement.where(
                col(UserActivity.event_type).in_(event_types),
            )

        result = await session.exec(statement)

        return int(result.one())
