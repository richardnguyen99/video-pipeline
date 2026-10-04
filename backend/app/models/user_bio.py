"""Optional extended biography for a user profile."""

import datetime
import uuid
from typing import Any, Optional, cast

from sqlalchemy import Date, Text
from sqlalchemy.sql.functions import now
from sqlmodel import Field, Relationship, SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel.sql.sqltypes import AutoString

from app.models.user import User


class UserBio(SQLModel, table=True):
    """Extended public biography fields for a single user.

    A user may have no row (empty bio), or a row with any subset of
    fields populated. All biography attributes are optional.

    Attributes:
        id: Primary key.
        user_id: One-to-one foreign key to ``User.id``.
        full_name: Legal or preferred full name.
        date_of_birth: Calendar date of birth (no time component).
        country: Free-form country or region label.
        gender: Gender label (restricted set of allowed values).
        biography: Longer free-text about the user.
        link: Single associated URL (portfolio, social, etc.).
        created_at: UTC timestamp set on creation.
        updated_at: UTC timestamp updated on every write.
    """

    __tablename__ = "user_bio"
    __table_args__ = {"schema": "public"}

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
    )
    user_id: uuid.UUID = Field(
        foreign_key="public.user.id",
        unique=True,
        index=True,
    )
    full_name: Optional[str] = Field(
        default=None,
        max_length=200,
        sa_type=AutoString,
    )
    date_of_birth: Optional[datetime.date] = Field(
        default=None,
        sa_type=Date,
    )
    country: Optional[str] = Field(
        default=None,
        max_length=100,
        sa_type=AutoString,
    )
    gender: Optional[str] = Field(
        default=None,
        max_length=50,
        sa_type=AutoString,
    )
    biography: Optional[str] = Field(
        default=None,
        sa_type=cast(type[Any], Text),
    )
    link: Optional[str] = Field(
        default=None,
        max_length=2048,
        sa_type=AutoString,
    )
    created_at: datetime.datetime = Field(default_factory=now)
    updated_at: datetime.datetime = Field(default_factory=now)

    user: User = Relationship(back_populates="bio")

    def __repr__(self) -> str:
        """Return a debug-friendly representation."""

        return f"UserBio(id={self.id!r}, user_id={self.user_id!r})"

    @classmethod
    def create(
        cls,
        *,
        user_id: uuid.UUID,
        full_name: Optional[str] = None,
        date_of_birth: Optional[datetime.date] = None,
        country: Optional[str] = None,
        gender: Optional[str] = None,
        biography: Optional[str] = None,
        link: Optional[str] = None,
    ) -> "UserBio":
        """Build a new ``UserBio`` instance (does not persist it).

        Args:
            user_id: Owning user's UUID.
            full_name: Optional legal or preferred full name.
            date_of_birth: Optional date of birth.
            country: Optional country or region label.
            gender: Optional gender label.
            biography: Optional free-text biography.
            link: Optional single associated URL.

        Returns:
            A new, unsaved ``UserBio`` instance.
        """

        return cls(
            user_id=user_id,
            full_name=full_name,
            date_of_birth=date_of_birth,
            country=country,
            gender=gender,
            biography=biography,
            link=link,
        )

    @staticmethod
    async def get_by_user_id(
        session: AsyncSession,
        user_id: uuid.UUID,
    ) -> Optional["UserBio"]:
        """Fetch the biography row for a given user, if any.

        Args:
            session: An active SQLModel/SQLAlchemy session.
            user_id: The owning user's UUID.

        Returns:
            The matching ``UserBio``, or ``None`` when absent.
        """

        statement = select(UserBio).where(UserBio.user_id == user_id)
        result = await session.exec(statement)

        return result.first()
