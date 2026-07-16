"""Login credential model."""

import datetime
import uuid
from typing import Optional

from app.models.user import User
from sqlalchemy.sql.functions import now
from sqlmodel import Field, Relationship, SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel.sql.sqltypes import AutoString


class UserCredential(SQLModel, table=True):
    """Password hash and login-security state for a single user.

    Attributes:
        id: Primary key.
        user_id: One-to-one foreign key to ``User.id``.
        password_hash: Hashed password (argon2/bcrypt) - never
            plaintext.
        password_algorithm: Name of the hashing algorithm used, to
            support future migration between algorithms.
        failed_login_attempts: Consecutive failed attempts, reset on
            success.
        locked_until: If set and in the future, login is blocked.
        last_login_at: Timestamp of the most recent successful login.
        password_changed_at: Timestamp of the last password change.
        created_at: UTC timestamp set on creation.
        updated_at: UTC timestamp updated on every write.
    """

    __tablename__ = "user_credential"
    __table_args__ = {"schema": "app_user_schema"}

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
    )
    user_id: uuid.UUID = Field(
        foreign_key="app_user_schema.user.id",
        unique=True,
        index=True,
    )
    password_hash: str = Field(
        max_length=255,
        sa_type=AutoString,
    )
    password_algorithm: str = Field(
        default="argon2",
        max_length=20,
        sa_type=AutoString,
    )

    failed_login_attempts: int = Field(default=0)
    locked_until: Optional[datetime.datetime] = Field(default=None)
    last_login_at: Optional[datetime.datetime] = Field(default=None)

    password_changed_at: datetime.datetime = Field(default_factory=now)
    created_at: datetime.datetime = Field(default_factory=now)
    updated_at: datetime.datetime = Field(default_factory=now)

    user: User = Relationship(back_populates="credential")

    def __repr__(self) -> str:
        """Return a debug-friendly representation (no secrets)."""
        return f"UserCredential(id={self.id!r}, " f"user_id={self.user_id!r})"

    @classmethod
    def create(
        cls, *, user_id: uuid.UUID, password_hash: str, **kwargs
    ) -> "UserCredential":
        """Build a new ``UserCredential`` (does not persist it).

        Args:
            user_id: The owning user's UUID.
            password_hash: Pre-hashed password value.
            **kwargs: Any other ``UserCredential`` fields to set.

        Returns:
            A new, unsaved ``UserCredential`` instance.
        """
        return cls(user_id=user_id, password_hash=password_hash, **kwargs)

    @staticmethod
    async def get_by_user_id(
        session: AsyncSession, user_id: uuid.UUID
    ) -> Optional["UserCredential"]:
        """Fetch credentials for a given user.

        Args:
            session: An active SQLModel/SQLAlchemy session.
            user_id: The owning user's UUID.

        Returns:
            The matching ``UserCredential``, or ``None`` if not
            found.
        """
        statement = select(UserCredential).where(UserCredential.user_id == user_id)
        result = await session.exec(statement)

        return result.one_or_none()
