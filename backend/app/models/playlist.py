"""Playlist models: ownership, video membership, and sharing.

Three tables, all owned by ``app_user`` in ``public``:

* ``Playlist`` — a named, ownable, renamable collection with
  private / restricted / public visibility.
* ``PlaylistVideo`` — the many-to-many join between playlists and
  videos. Uses the association-object pattern (not a plain
  ``link_model``) because it carries extra data: ordering
  (``position``) and ``added_at``.
* ``PlaylistShare`` — explicit per-user access grants for
  restricted playlists, separate from ``Playlist.owner``.
"""

# pylint: disable=no-member

import datetime
import uuid
from enum import Enum
from typing import Optional

from sqlalchemy import Column
from sqlalchemy import Enum as SAEnum
from sqlalchemy.sql.functions import count
from sqlalchemy.sql.functions import max as max_
from sqlalchemy.sql.functions import now as sa_now
from sqlmodel import (
    Field,
    Relationship,
    SQLModel,
    UniqueConstraint,
    and_,
    col,
    or_,
    select,
)
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel.sql.sqltypes import AutoString

from app.models.user import User
from app.models.video import Video, VideoImageUrl


class PlaylistVisibility(str, Enum):
    """Who can view a playlist.

    * ``private`` — owner only
    * ``restricted`` — owner and users with an explicit share
    * ``public`` — everyone, including anonymous viewers
    """

    PUBLIC = "public"
    RESTRICTED = "restricted"
    PRIVATE = "private"


class Playlist(SQLModel, table=True):
    """A named collection of videos owned by a single user."""

    __tablename__ = "playlist"
    __table_args__ = {"schema": "public", "extend_existing": True}

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_id: uuid.UUID = Field(
        foreign_key="public.user.id",
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
                # Unqualified → public schema (Postgres default)
                native_enum=True,
            ),
            nullable=False,
        ),
    )
    created_at: datetime.datetime = Field(
        default_factory=lambda: datetime.datetime.now(
            datetime.timezone.utc
        ).replace(tzinfo=None),
        sa_column_kwargs={
            "server_default": sa_now(),
        },
    )
    updated_at: datetime.datetime = Field(
        default_factory=lambda: datetime.datetime.now(
            datetime.timezone.utc
        ).replace(tzinfo=None),
        sa_column_kwargs={
            "server_default": sa_now(),
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
        self.updated_at = datetime.datetime.now(datetime.timezone.utc).replace(
            tzinfo=None
        )

    def set_visibility(self, visibility: PlaylistVisibility) -> None:
        """Change playlist visibility, bumping ``updated_at``."""

        self.visibility = visibility
        self.updated_at = datetime.datetime.now(datetime.timezone.utc).replace(
            tzinfo=None
        )

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

        * ``public`` — anyone, including anonymous callers
        * ``private`` — owner only
        * ``restricted`` — owner, or an authenticated user with an
          explicit ``PlaylistShare``

        ``user_id`` may be ``None`` for an anonymous caller.
        """

        if playlist.visibility == PlaylistVisibility.PUBLIC:
            return True

        if user_id is None:
            return False

        if playlist.owner_id == user_id:
            return True

        if playlist.visibility == PlaylistVisibility.PRIVATE:
            return False

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
                    and_(
                        Playlist.visibility == PlaylistVisibility.RESTRICTED,
                        col(Playlist.id).in_(shared_playlist_ids),
                    ),
                )
            )
            .order_by(col(Playlist.updated_at).desc())
            .limit(limit)
            .offset(offset)
        )
        result = await session.exec(statement)
        return list(result.all())

    @staticmethod
    async def list_owned_by_user(
        session: AsyncSession,
        owner_id: uuid.UUID,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> list["Playlist"]:
        """Fetch playlists owned by a user, newest updates first."""

        statement = (
            select(Playlist)
            .where(Playlist.owner_id == owner_id)
            .order_by(col(Playlist.updated_at).desc())
            .limit(limit)
            .offset(offset)
        )
        result = await session.exec(statement)

        return list(result.all())

    @staticmethod
    async def count_owned_by_user(
        session: AsyncSession,
        owner_id: uuid.UUID,
    ) -> int:
        """Return how many playlists a user owns."""

        statement = (
            select(count())
            .select_from(Playlist)
            .where(Playlist.owner_id == owner_id)
        )
        result = await session.exec(statement)

        return int(result.one())

    @staticmethod
    async def list_public_by_owner(
        session: AsyncSession,
        owner_id: uuid.UUID,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> list["Playlist"]:
        """Fetch public playlists owned by a user, newest updates first."""

        statement = (
            select(Playlist)
            .where(
                Playlist.owner_id == owner_id,
                Playlist.visibility == PlaylistVisibility.PUBLIC,
            )
            .order_by(col(Playlist.updated_at).desc())
            .limit(limit)
            .offset(offset)
        )
        result = await session.exec(statement)

        return list(result.all())

    @staticmethod
    async def count_public_by_owner(
        session: AsyncSession,
        owner_id: uuid.UUID,
    ) -> int:
        """Return how many public playlists a user owns."""

        statement = (
            select(count())
            .select_from(Playlist)
            .where(
                Playlist.owner_id == owner_id,
                Playlist.visibility == PlaylistVisibility.PUBLIC,
            )
        )
        result = await session.exec(statement)

        return int(result.one())

    @staticmethod
    async def delete(
        session: AsyncSession,
        playlist: "Playlist",
    ) -> None:
        """Delete a playlist and cascaded memberships / shares."""

        await session.delete(playlist)
        await session.commit()


class PlaylistVideo(SQLModel, table=True):
    """One video's membership in one playlist (association object)."""

    __tablename__ = "playlist_video"
    __table_args__ = (
        UniqueConstraint(
            "playlist_id",
            "video_id",
        ),
        {"schema": "public", "extend_existing": True},
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    playlist_id: uuid.UUID = Field(
        foreign_key="public.playlist.id",
        index=True,
    )
    video_id: int = Field(foreign_key="public.video.id", index=True)
    position: int = Field(default=0)
    added_at: datetime.datetime = Field(
        default_factory=lambda: datetime.datetime.now(
            datetime.timezone.utc
        ).replace(tzinfo=None),
        sa_column_kwargs={
            "server_default": sa_now(),
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
    async def first_thumbnail_urls_for_playlists(
        session: AsyncSession,
        playlist_ids: list[uuid.UUID],
    ) -> dict[uuid.UUID, str | None]:
        """Map playlist ids to the first video image URL (by position)."""

        if not playlist_ids:
            return {}

        membership_statement = (
            select(PlaylistVideo)
            .where(col(PlaylistVideo.playlist_id).in_(playlist_ids))
            .order_by(
                col(PlaylistVideo.playlist_id),
                col(PlaylistVideo.position),
            )
        )
        membership_rows = list(
            (await session.exec(membership_statement)).all()
        )
        first_video_by_playlist: dict[uuid.UUID, int] = {}

        for row in membership_rows:
            if row.playlist_id not in first_video_by_playlist:
                first_video_by_playlist[row.playlist_id] = row.video_id

        mapping: dict[uuid.UUID, str | None] = {
            playlist_id: None for playlist_id in playlist_ids
        }

        if not first_video_by_playlist:
            return mapping

        video_ids = list(set(first_video_by_playlist.values()))
        image_statement = (
            select(VideoImageUrl)
            .where(col(VideoImageUrl.fk_id).in_(video_ids))
            .order_by(col(VideoImageUrl.fk_id), col(VideoImageUrl.id))
        )
        image_rows = list((await session.exec(image_statement)).all())
        images_by_video: dict[int, list[VideoImageUrl]] = {}

        for image in image_rows:
            if not image.url:
                continue

            images_by_video.setdefault(image.fk_id, []).append(image)

        type_priority = ("list", "small", "large")
        first_image_by_video: dict[int, str] = {}

        for video_id, images in images_by_video.items():
            chosen_url: str | None = None

            for preferred in type_priority:
                match = next(
                    (
                        image.url
                        for image in images
                        if (image.type or "").strip().lower() == preferred
                    ),
                    None,
                )

                if match is not None:
                    chosen_url = match
                    break

            if chosen_url is None:
                chosen_url = images[0].url

            first_image_by_video[video_id] = chosen_url

        for playlist_id, video_id in first_video_by_playlist.items():
            mapping[playlist_id] = first_image_by_video.get(video_id)

        return mapping

    @staticmethod
    async def playlist_ids_containing_video(
        session: AsyncSession,
        playlist_ids: list[uuid.UUID],
        video_id: int,
    ) -> set[uuid.UUID]:
        """Return playlist ids from ``playlist_ids`` that contain ``video_id``."""

        if not playlist_ids:
            return set()

        statement = select(PlaylistVideo.playlist_id).where(
            col(PlaylistVideo.playlist_id).in_(playlist_ids),
            PlaylistVideo.video_id == video_id,
        )
        result = await session.exec(statement)

        return set(result.all())

    @staticmethod
    async def count_for_playlist(
        session: AsyncSession,
        playlist_id: uuid.UUID,
    ) -> int:
        """Return the number of videos in a playlist."""

        statement = (
            select(count())
            .select_from(PlaylistVideo)
            .where(PlaylistVideo.playlist_id == playlist_id)
        )
        result = await session.exec(statement)

        return int(result.one())

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
        ),
        {"schema": "public", "extend_existing": True},
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    playlist_id: uuid.UUID = Field(
        foreign_key="public.playlist.id",
        index=True,
    )
    shared_with_user_id: uuid.UUID = Field(
        foreign_key="public.user.id",
        index=True,
    )
    can_edit: bool = Field(default=False)
    created_at: datetime.datetime = Field(
        default_factory=lambda: datetime.datetime.now(
            datetime.timezone.utc
        ).replace(tzinfo=None),
        sa_column_kwargs={
            "server_default": sa_now(),
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

        share = (await session.exec(statement)).first()
        if share is None:
            return False

        await session.delete(share)
        await session.commit()

        return True
