"""Playlist models: ownership, video membership, and sharing.

Three tables, all owned by ``app_user`` in ``app_user_schema``:

* ``Playlist`` — a named, ownable, renamable collection with a
  public/private visibility flag.
* ``PlaylistVideo`` — the many-to-many join between playlists and
  videos. Uses the association-object pattern (not a plain
  ``link_model``) because it carries extra data: ordering
  (``position``) and ``added_at``.
* ``PlaylistShare`` — explicit per-user access grants for private
  playlists, separate from ``Playlist.owner``.
"""

# pylint: disable=no-member

import datetime
import uuid
from enum import Enum
from typing import Optional

from app.models.user import User
from app.models.video import Video
from sqlalchemy import Column
from sqlalchemy import Enum as SAEnum
from sqlalchemy.sql.functions import max as max_
from sqlalchemy.sql.functions import now
from sqlmodel import (
    Field,
    Relationship,
    SQLModel,
    UniqueConstraint,
    col,
    or_,
    select,
)
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel.sql.sqltypes import AutoString


class PlaylistVisibility(str, Enum):
    """Who can view a playlist without an explicit share."""

    PUBLIC = "public"
    PRIVATE = "private"


class Playlist(SQLModel, table=True):
    """A named collection of videos owned by a single user."""

    __tablename__ = "playlist"
    __table_args__ = {"schema": "app_user_schema"}

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_id: uuid.UUID = Field(
        foreign_key="app_user_schema.user.id",
        index=True,
    )
    name: str = Field(max_length=255, sa_type=AutoString)
    description: Optional[str] = Field(default=None, sa_type=AutoString)
    visibility: PlaylistVisibility = Field(
        default=PlaylistVisibility.PRIVATE,
        sa_column=Column(
            SAEnum(
                PlaylistVisibility,
                name="playlist_visibility",
                schema="app_user_schema",
            ),
            nullable=False,
        ),
    )
    created_at: datetime.datetime = Field(
        default_factory=now,
        sa_column_kwargs={
            "server_default": now(),
        },
    )
    updated_at: datetime.datetime = Field(
        default_factory=now,
        sa_column_kwargs={
            "server_default": now(),
        },
    )

    owner: User = Relationship(back_populates="playlists")
    playlist_videos: list["PlaylistVideo"] = Relationship(
        back_populates="playlist",
        sa_relationship_kwargs={
            "order_by": "PlaylistVideo.position",
            "cascade": "all, delete-orphan",
        },
    )
    shares: list["PlaylistShare"] = Relationship(
        back_populates="playlist",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )

    def __repr__(self) -> str:
        """Return a debug-friendly representation."""

        return (
            f"Playlist(id={self.id!r}, name={self.name!r}, "
            f"visibility={self.visibility!r})"
        )

    @classmethod
    def create(
        cls,
        *,
        owner_id: uuid.UUID,
        name: str,
        visibility: PlaylistVisibility = PlaylistVisibility.PRIVATE,
        description: Optional[str] = None,
    ) -> "Playlist":
        """Build a new ``Playlist`` instance (does not persist it)."""

        return cls(
            owner_id=owner_id,
            name=name,
            visibility=visibility,
            description=description,
        )

    def rename(self, new_name: str) -> None:
        """Rename the playlist, bumping ``updated_at``."""

        self.name = new_name
        self.updated_at = now()

    def set_visibility(self, visibility: PlaylistVisibility) -> None:
        """Change public/private visibility, bumping ``updated_at``."""

        self.visibility = visibility
        self.updated_at = now()

    @staticmethod
    async def get_by_id(
        session: AsyncSession,
        playlist_id: uuid.UUID,
    ) -> Optional["Playlist"]:
        """Fetch a playlist by primary key."""

        stmt = select(Playlist).where(Playlist.id == playlist_id)

        result = await session.exec(stmt)
        return result.one_or_none()

    @staticmethod
    async def is_accessible_by(
        session: AsyncSession,
        playlist: "Playlist",
        user_id: Optional[uuid.UUID],
    ) -> bool:
        """Return True if ``user_id`` may view this playlist.

        True when the playlist is public, when the caller is the
        owner, or when the caller has an explicit ``PlaylistShare``.
        ``user_id`` may be ``None`` for an anonymous caller (only
        public playlists are accessible).
        """

        if playlist.visibility == PlaylistVisibility.PUBLIC:
            return True
        if user_id is None:
            return False
        if playlist.owner_id == user_id:
            return True

        statement = select(PlaylistShare).where(
            PlaylistShare.playlist_id == playlist.id,
            PlaylistShare.shared_with_user_id == user_id,
        )

        result = await session.exec(statement)

        return result.first() is not None

    @staticmethod
    async def get_visible_to_user(
        session: AsyncSession,
        user_id: uuid.UUID,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> list["Playlist"]:
        """Fetch playlists a user can see: owned, public, or shared."""

        shared_playlist_ids = select(PlaylistShare.playlist_id).where(
            PlaylistShare.shared_with_user_id == user_id
        )
        statement = (
            select(Playlist)
            .where(
                or_(
                    Playlist.owner_id == user_id,
                    Playlist.visibility == PlaylistVisibility.PUBLIC,
                    col(Playlist.id).in_(shared_playlist_ids),
                )
            )
            .order_by(col(Playlist.updated_at).desc())
            .limit(limit)
            .offset(offset)
        )
        result = await session.exec(statement)
        return list(result.all())


class PlaylistVideo(SQLModel, table=True):
    """One video's membership in one playlist (association object)."""

    __tablename__ = "playlist_video"
    __table_args__ = (
        UniqueConstraint(
            "playlist_id",
            "video_id",
            name="uq_playlist_video_playlist_video",
        ),
        {"schema": "app_user_schema"},
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    playlist_id: uuid.UUID = Field(
        foreign_key="app_user_schema.playlist.id",
        index=True,
    )
    video_id: int = Field(foreign_key="public.video.id", index=True)
    position: int = Field(default=0)
    added_at: datetime.datetime = Field(
        default_factory=now,
        sa_column_kwargs={
            "server_default": now(),
        },
    )

    playlist: Playlist = Relationship(back_populates="playlist_videos")
    video: Video = Relationship(back_populates="playlist_entries")

    def __repr__(self) -> str:
        """Return a debug-friendly representation."""

        return (
            f"PlaylistVideo(playlist_id={self.playlist_id!r}, "
            f"video_id={self.video_id!r}, position={self.position!r})"
        )

    @staticmethod
    async def get_next_position(
        session: AsyncSession,
        playlist_id: uuid.UUID,
    ) -> int:
        """Return the next free ``position`` in a playlist (0 if empty)."""

        statement = select(max_(PlaylistVideo.position)).where(
            PlaylistVideo.playlist_id == playlist_id
        )
        result = await session.exec(statement)
        current_max = result.one()

        return 0 if current_max is None else current_max + 1

    @staticmethod
    async def add_video(
        session: AsyncSession,
        playlist_id: uuid.UUID,
        video_id: int,
    ) -> "PlaylistVideo":
        """Append a video to the end of a playlist.

        Raises whatever integrity error the DB raises (via the
        unique constraint) if the video is already in the playlist;
        check with ``get_by_playlist_and_video`` first if you want to
        no-op instead.
        """

        position = await PlaylistVideo.get_next_position(
            session,
            playlist_id,
        )
        entry = PlaylistVideo(
            playlist_id=playlist_id,
            video_id=video_id,
            position=position,
        )
        session.add(entry)

        return entry

    @staticmethod
    async def get_by_playlist_and_video(
        session: AsyncSession,
        playlist_id: uuid.UUID,
        video_id: int,
    ) -> Optional["PlaylistVideo"]:
        """Fetch a single membership row, if it exists."""

        statement = select(PlaylistVideo).where(
            PlaylistVideo.playlist_id == playlist_id,
            PlaylistVideo.video_id == video_id,
        )

        result = await session.exec(statement)

        return result.first()

    @staticmethod
    async def get_videos_in_playlist(
        session: AsyncSession,
        playlist_id: uuid.UUID,
    ) -> list["PlaylistVideo"]:
        """Fetch a playlist's videos in order."""

        statement = (
            select(PlaylistVideo)
            .where(PlaylistVideo.playlist_id == playlist_id)
            .order_by(col(PlaylistVideo.position))
        )
        result = await session.exec(statement)

        return list(result.all())

    @staticmethod
    async def remove_video(
        session: AsyncSession,
        playlist_id: uuid.UUID,
        video_id: int,
    ) -> bool:
        """Remove a video from a playlist.

        Returns:
            True if a row was deleted, False if it wasn't there.
        """

        entry = await PlaylistVideo.get_by_playlist_and_video(
            session,
            playlist_id,
            video_id,
        )

        if entry is None:
            return False
        await session.delete(entry)
        await session.commit()

        return True


class PlaylistShare(SQLModel, table=True):
    """An explicit access grant for a private playlist."""

    __tablename__ = "playlist_share"
    __table_args__ = (
        UniqueConstraint(
            "playlist_id",
            "shared_with_user_id",
            name="uq_playlist_share_playlist_user",
        ),
        {"schema": "app_user_schema"},
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    playlist_id: uuid.UUID = Field(
        foreign_key="app_user_schema.playlist.id",
        index=True,
    )
    shared_with_user_id: uuid.UUID = Field(
        foreign_key="app_user_schema.user.id",
        index=True,
    )
    can_edit: bool = Field(default=False)
    created_at: datetime.datetime = Field(
        default_factory=now,
        sa_column_kwargs={
            "server_default": now(),
        },
    )
    playlist: Playlist = Relationship(back_populates="shares")
    shared_with_user: User = Relationship(
        back_populates="playlist_shares_received",
    )

    def __repr__(self) -> str:
        """Return a debug-friendly representation."""

        return (
            f"PlaylistShare(playlist_id={self.playlist_id!r}, "
            f"shared_with_user_id={self.shared_with_user_id!r})"
        )

    @classmethod
    def create(
        cls,
        *,
        playlist_id: uuid.UUID,
        shared_with_user_id: uuid.UUID,
        can_edit: bool = False,
    ) -> "PlaylistShare":
        """Build a new ``PlaylistShare`` instance (does not persist it)."""

        return cls(
            playlist_id=playlist_id,
            shared_with_user_id=shared_with_user_id,
            can_edit=can_edit,
        )

    @staticmethod
    async def revoke(
        session: AsyncSession,
        playlist_id: uuid.UUID,
        shared_with_user_id: uuid.UUID,
    ) -> bool:
        """Remove a share.

        Returns:
            True if a row was deleted, False if it wasn't there.
        """

        statement = select(PlaylistShare).where(
            PlaylistShare.playlist_id == playlist_id,
            PlaylistShare.shared_with_user_id == shared_with_user_id,
        )

        share = await session.exec(statement).first()
        if share is None:
            return False

        await session.delete(share)
        await session.commit()

        return True
