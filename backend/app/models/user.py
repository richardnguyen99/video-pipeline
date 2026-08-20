"""User profile model."""

import datetime
import uuid
from typing import TYPE_CHECKING, Optional

from sqlalchemy.sql.functions import now
from sqlmodel import Field, Relationship, SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel.sql.sqltypes import AutoString

if TYPE_CHECKING:
    from app.models.comments import Comment
    from app.models.credentials import UserCredential
    from app.models.playlist import Playlist, PlaylistShare
    from app.models.refresh_token import RefreshToken
    from app.models.user_actress_subscribe import UserActressSubscribe
    from app.models.video_reaction import VideoReaction
    from app.models.video_view import VideoView


class User(SQLModel, table=True):
    """Core user identity and profile.

    Attributes:
        id: Primary key, generated client-side as a UUID4.
        username: Unique handle used for login/display.
        email: Unique contact address.
        display_name: Optional human-friendly name.
        is_active: Soft-disable flag; false blocks login without
            deleting the row.
        created_at: UTC timestamp set on creation.
        updated_at: UTC timestamp updated on every write.
    """

    __tablename__ = "user"
    __table_args__ = {"schema": "public"}

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
    )
    username: str = Field(
        max_length=50,
        unique=True,
        index=True,
        sa_type=AutoString,
    )
    email: str = Field(
        max_length=255,
        unique=True,
        index=True,
        sa_type=AutoString,
    )
    display_name: Optional[str] = Field(
        default=None,
        max_length=100,
        sa_type=AutoString,
    )
    is_active: bool = Field(default=True)
    created_at: datetime.datetime = Field(
        default_factory=now,
    )
    updated_at: datetime.datetime = Field(
        default_factory=now,
        sa_column_kwargs={"onupdate": now},
    )

    credential: Optional["UserCredential"] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={"uselist": False},
    )
    refresh_tokens: list["RefreshToken"] = Relationship(back_populates="user")
    comments: list["Comment"] = Relationship(back_populates="user")
    video_reactions: list["VideoReaction"] = Relationship(
        back_populates="user",
    )
    views: list["VideoView"] = Relationship(back_populates="user")
    playlists: list["Playlist"] = Relationship(back_populates="owner")
    playlist_shares_received: list["PlaylistShare"] = Relationship(
        back_populates="shared_with_user"
    )
    actress_subscriptions: list["UserActressSubscribe"] = Relationship(
        back_populates="user",
    )

    def __repr__(self) -> str:
        """Return a debug-friendly representation."""

        return f"User(id={self.id!r}, username={self.username!r})"

    @classmethod
    def create(cls, *, username: str, email: str, **kwargs) -> "User":
        """Build a new ``User`` instance (does not persist it).

        Args:
            username: Unique login handle.
            email: Unique contact address.
            **kwargs: Any other ``User`` fields to set.

        Returns:
            A new, unsaved ``User`` instance.
        """

        return cls(username=username, email=email, **kwargs)

    @staticmethod
    async def get_by_id(
        session: AsyncSession, user_id: uuid.UUID
    ) -> Optional["User"]:
        """Fetch a user by primary key.

        Args:
            session: An active SQLModel/SQLAlchemy session.
            user_id: The user's UUID primary key.

        Returns:
            The matching ``User``, or ``None`` if not found.
        """

        statement = select(User).where(User.id == user_id)
        result = await session.exec(statement)

        return result.first()
