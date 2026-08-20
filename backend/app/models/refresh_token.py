"""JWT refresh token tracking.

Access tokens are stateless JWTs and are never persisted. Refresh
tokens are persisted (as hashes) so sessions can be revoked, rotated,
and audited.
"""

import datetime
import uuid
from typing import Optional

from sqlalchemy.sql.functions import now
from sqlmodel import Field, Relationship, SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel.sql.sqltypes import AutoString

from app.models.user import User


class RefreshToken(SQLModel, table=True):
    """Server-side record of an issued refresh token.

    Only a hash of the token (e.g. SHA-256) is stored; the raw token
    is returned to the client once and never persisted, the same
    principle used for password storage.

    Attributes:
        id: Primary key.
        user_id: Owning user's UUID.
        token_hash: Hash of the raw refresh token, unique/indexed
            for fast lookup on refresh.
        issued_at: UTC timestamp when the token was issued.
        expires_at: UTC timestamp after which the token is invalid.
        revoked_at: Set when the token is explicitly revoked
            (logout, rotation, or detected reuse).
        replaced_by_id: Points to the token that replaced this one
            on rotation, forming an auditable chain.
        user_agent: Client user agent at issuance, for session
            listings.
        ip_address: Client IP at issuance, for session listings.
    """

    __tablename__ = "refresh_token"
    __table_args__ = {"schema": "public"}

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
    )
    user_id: uuid.UUID = Field(
        foreign_key="public.user.id",
        index=True,
    )

    token_hash: str = Field(
        max_length=255,
        unique=True,
        index=True,
        sa_type=AutoString,
    )
    issued_at: datetime.datetime = Field(
        default_factory=now,
        sa_column_kwargs={"server_default": now()},
    )
    expires_at: datetime.datetime
    revoked_at: Optional[datetime.datetime] = Field(default=None)

    replaced_by_id: Optional[uuid.UUID] = Field(
        default=None,
        foreign_key="public.refresh_token.id",
    )

    user_agent: Optional[str] = Field(
        default=None,
        max_length=255,
        sa_type=AutoString,
    )
    ip_address: Optional[str] = Field(
        default=None,
        max_length=45,
        sa_type=AutoString,
    )

    user: User = Relationship(back_populates="refresh_tokens")

    def __repr__(self) -> str:
        """Return a debug-friendly representation (no token value)."""
        return (
            f"RefreshToken(id={self.id!r}, "
            f"user_id={self.user_id!r}, "
            f"revoked={self.revoked_at is not None})"
        )

    @property
    def is_active(self) -> bool:
        """Return True if the token is neither expired nor revoked."""
        db_now = datetime.datetime.now(datetime.timezone.utc)
        return self.revoked_at is None and self.expires_at > db_now

    @classmethod
    def create(
        cls,
        *,
        user_id: uuid.UUID,
        token_hash: str,
        expires_at: datetime.datetime,
        **kwargs,
    ) -> "RefreshToken":
        """Build a new ``RefreshToken`` (does not persist it).

        Args:
            user_id: The owning user's UUID.
            token_hash: Hash of the raw refresh token.
            expires_at: UTC expiry timestamp.
            **kwargs: Any other ``RefreshToken`` fields to set.

        Returns:
            A new, unsaved ``RefreshToken`` instance.
        """
        return cls(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at,
            **kwargs,
        )

    @staticmethod
    async def get_by_token_hash(
        session: AsyncSession,
        token_hash: str,
    ) -> Optional["RefreshToken"]:
        """Fetch a refresh token record by its hash.

        Args:
            session: An active SQLModel/SQLAlchemy session.
            token_hash: Hash of the raw refresh token presented by
                the client.

        Returns:
            The matching ``RefreshToken``, or ``None`` if not found.
        """
        statement = select(RefreshToken).where(
            RefreshToken.token_hash == token_hash
        )
        result = await session.exec(statement)

        return result.first()
