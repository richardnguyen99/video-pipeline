"""User content preferences (interest / dislike) for catalog entities."""

from __future__ import annotations

import datetime
import uuid
from enum import Enum
from typing import Optional

from sqlalchemy import UniqueConstraint
from sqlalchemy.sql.functions import now as sa_now
from sqlmodel import Field, SQLModel, col, select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel.sql.sqltypes import AutoString


class PreferencePolarity(str, Enum):
    """Whether the user wants more or less of an entity."""

    INTEREST = "interest"
    DISLIKE = "dislike"


class PreferenceEntityType(str, Enum):
    """Catalog entity kinds that can be tagged as interest or dislike."""

    ACTRESS = "actress"
    MAKER = "maker"
    GENRE = "genre"
    SERIES = "series"
    LABEL = "label"
    DIRECTOR = "director"


class UserContentPreference(SQLModel, table=True):
    """One preferred or disliked catalog entity for a user.

    A user may hold only one polarity per ``(entity_type, entity_id)``.
    Adding the opposite polarity replaces the existing row.
    """

    __tablename__ = "user_content_preference"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "entity_type",
            "entity_id",
        ),
        {"schema": "public", "extend_existing": True},
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        foreign_key="user.id",
        index=True,
    )
    polarity: str = Field(
        max_length=16,
        sa_type=AutoString,
        index=True,
    )
    entity_type: str = Field(
        max_length=32,
        sa_type=AutoString,
        index=True,
    )
    entity_id: int = Field(index=True)
    entity_name: Optional[str] = Field(
        default=None,
        max_length=255,
        sa_type=AutoString,
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
            f"UserContentPreference(id={self.id!r}, user_id={self.user_id!r}, "
            f"polarity={self.polarity!r}, entity_type={self.entity_type!r}, "
            f"entity_id={self.entity_id!r})"
        )

    @staticmethod
    async def list_for_user(
        session: AsyncSession,
        *,
        user_id: uuid.UUID,
        polarity: Optional[str] = None,
    ) -> list["UserContentPreference"]:
        """Return preferences for a user, newest first."""

        statement = select(UserContentPreference).where(
            UserContentPreference.user_id == user_id,
        )

        if polarity is not None:
            statement = statement.where(
                UserContentPreference.polarity == polarity,
            )

        statement = statement.order_by(
            col(UserContentPreference.created_at).desc(),
        )
        result = await session.exec(statement)

        return list(result.all())

    @staticmethod
    async def get_by_user_and_entity(
        session: AsyncSession,
        *,
        user_id: uuid.UUID,
        entity_type: str,
        entity_id: int,
    ) -> Optional["UserContentPreference"]:
        """Fetch a single preference by user and entity identity."""

        statement = select(UserContentPreference).where(
            UserContentPreference.user_id == user_id,
            UserContentPreference.entity_type == entity_type,
            UserContentPreference.entity_id == entity_id,
        )
        result = await session.exec(statement)

        return result.first()
