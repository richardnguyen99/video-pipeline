"""Video-related SQLModel models."""

import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKeyConstraint,
    Index,
    Integer,
    PrimaryKeyConstraint,
    String,
    Text,
    UniqueConstraint,
)
from sqlmodel import Field, Relationship

from app.models.associations import (
    t_video_actress,
    t_video_director,
    t_video_genre,
    t_video_label,
    t_video_maker,
    t_video_series,
)
from app.models.base import IdTimestampMixin

if TYPE_CHECKING:
    from app.models.actress import Actress
    from app.models.comments import Comment
    from app.models.director import Director
    from app.models.genre import Genre
    from app.models.label import Label
    from app.models.maker import Maker
    from app.models.playlist import PlaylistVideo
    from app.models.series import Series
    from app.models.video_reaction import VideoReaction
    from app.models.video_view import VideoView


class Video(IdTimestampMixin, table=True):
    """Represents a video entity."""

    __table_args__ = (
        PrimaryKeyConstraint("id"),
        UniqueConstraint("video_id"),
        Index(None, "video_id"),
        {"schema": "public", "extend_existing": True},
    )

    video_id: str = Field(
        sa_column=Column(
            "video_id",
            String(255),
            nullable=False,
        ),
    )
    title: Optional[str] = Field(
        default=None,
        sa_column=Column(
            "title",
            Text,
        ),
    )
    cid: Optional[str] = Field(
        default=None,
        sa_column=Column(
            "cid",
            String(255),
        ),
    )
    duration: Optional[int] = Field(
        default=None,
        sa_column=Column(
            "duration",
            Integer,
        ),
    )
    release_date: Optional[datetime.datetime] = Field(
        default=None,
        sa_column=Column(
            "release_date",
            DateTime,
        ),
    )
    jancode: Optional[str] = Field(
        default=None,
        sa_column=Column(
            "jancode",
            String(255),
        ),
    )
    maker_product: Optional[str] = Field(
        default=None,
        sa_column=Column(
            "maker_product",
            String(255),
        ),
    )
    floor_code: Optional[str] = Field(
        default=None,
        sa_column=Column(
            "floor_code",
            String(50),
        ),
    )

    video_aka: list["VideoAka"] = Relationship(back_populates="fk")
    video_image_url: list["VideoImageUrl"] = Relationship(back_populates="fk")
    video_m3u8: list["VideoM3u8"] = Relationship(back_populates="fk")
    video_sample_image_url: list["VideoSampleImageUrl"] = Relationship(
        back_populates="fk",
    )
    video_sample_movie_url: list["VideoSampleMovieUrl"] = Relationship(
        back_populates="fk",
    )
    comments: list["Comment"] = Relationship(back_populates="video")
    reactions: list["VideoReaction"] = Relationship(back_populates="video")
    views: list["VideoView"] = Relationship(back_populates="video")
    playlist_entries: list["PlaylistVideo"] = Relationship(
        back_populates="video",
    )
    actresses: list["Actress"] = Relationship(
        back_populates="videos",
        sa_relationship_kwargs={"secondary": t_video_actress},
    )
    genres: list["Genre"] = Relationship(
        sa_relationship_kwargs={"secondary": t_video_genre},
    )
    series: list["Series"] = Relationship(
        sa_relationship_kwargs={"secondary": t_video_series},
    )
    makers: list["Maker"] = Relationship(
        sa_relationship_kwargs={"secondary": t_video_maker},
    )
    labels: list["Label"] = Relationship(
        sa_relationship_kwargs={"secondary": t_video_label},
    )
    directors: list["Director"] = Relationship(
        sa_relationship_kwargs={"secondary": t_video_director},
    )

    def __repr__(self) -> str:
        """Return a string representation."""

        return f"Video(id={self.id!r}, video_id={self.video_id!r})"


class VideoAka(IdTimestampMixin, table=True):
    """Represents an alternative name (aka) for a video."""

    __tablename__ = "video_aka"
    __table_args__ = (
        ForeignKeyConstraint(
            ["fk_id"],
            ["public.video.id"],
            ondelete="CASCADE",
        ),
        PrimaryKeyConstraint("id"),
        Index(None, "fk_id"),
        {"schema": "public", "extend_existing": True},
    )

    fk_id: int = Field(
        sa_column=Column(
            "fk_id",
            Integer,
            nullable=False,
        ),
    )
    translated_name: str = Field(
        sa_column=Column(
            "translated_name",
            Text,
            nullable=False,
        ),
    )
    language: str = Field(
        sa_column=Column(
            "language",
            String(10),
            nullable=False,
        ),
    )
    name_type: str = Field(
        sa_column=Column(
            "name_type",
            String(20),
            nullable=False,
        ),
    )

    fk: "Video" = Relationship(back_populates="video_aka")

    def __repr__(self) -> str:
        """Return a string representation."""

        return f"VideoAka(id={self.id!r}, fk_id={self.fk_id!r})"


class VideoImageUrl(IdTimestampMixin, table=True):
    """Represents an image URL associated with a video."""

    __tablename__ = "video_image_url"
    __table_args__ = (
        ForeignKeyConstraint(
            ["fk_id"],
            ["public.video.id"],
            ondelete="CASCADE",
        ),
        PrimaryKeyConstraint("id"),
        UniqueConstraint("fk_id", "url"),
        Index(None, "fk_id"),
        {"schema": "public", "extend_existing": True},
    )

    url: str = Field(
        sa_column=Column(
            "url",
            Text,
            nullable=False,
        ),
    )
    fk_id: int = Field(
        sa_column=Column(
            "fk_id",
            Integer,
            nullable=False,
        ),
    )
    type: Optional[str] = Field(
        default=None,
        sa_column=Column(
            "type",
            String(50),
        ),
    )

    fk: "Video" = Relationship(back_populates="video_image_url")

    def __repr__(self) -> str:
        """Return a string representation."""

        return f"VideoImageUrl(id={self.id!r}, fk_id={self.fk_id!r})"


class VideoM3u8(IdTimestampMixin, table=True):
    """Represents an M3U8 stream URL associated with a video."""

    __tablename__ = "video_m3u8"
    __table_args__ = (
        ForeignKeyConstraint(
            columns=["fk_id"],
            refcolumns=["public.video.id"],
            ondelete="CASCADE",
        ),
        PrimaryKeyConstraint("id"),
        UniqueConstraint(
            "fk_id",
            "m3u8_url",
        ),
        Index(None, "fk_id"),
        {"schema": "public", "extend_existing": True},
    )

    fk_id: int = Field(
        sa_column=Column(
            "fk_id",
            Integer,
            nullable=False,
        ),
    )
    m3u8_url: str = Field(
        sa_column=Column(
            "m3u8_url",
            String(2048),
            nullable=False,
        ),
    )

    fk: "Video" = Relationship(back_populates="video_m3u8")

    def __repr__(self) -> str:
        """Return a string representation."""

        return f"VideoM3u8(id={self.id!r}, fk_id={self.fk_id!r})"


class VideoSampleImageUrl(IdTimestampMixin, table=True):
    """Represents a sample image URL associated with a video."""

    __tablename__ = "video_sample_image_url"
    __table_args__ = (
        ForeignKeyConstraint(
            columns=["fk_id"],
            refcolumns=["public.video.id"],
            ondelete="CASCADE",
        ),
        PrimaryKeyConstraint("id"),
        UniqueConstraint("fk_id", "url"),
        Index(None, "fk_id"),
        {"schema": "public", "extend_existing": True},
    )

    url: str = Field(
        sa_column=Column(
            "url",
            Text,
            nullable=False,
        ),
    )
    fk_id: int = Field(
        sa_column=Column(
            "fk_id",
            Integer,
            nullable=False,
        ),
    )
    type: Optional[str] = Field(
        default=None,
        sa_column=Column(
            "type",
            String(50),
        ),
    )

    fk: "Video" = Relationship(back_populates="video_sample_image_url")

    def __repr__(self) -> str:
        """Return a string representation."""

        return f"VideoSampleImageUrl(id={self.id!r}, fk_id={self.fk_id!r})"


class VideoSampleMovieUrl(IdTimestampMixin, table=True):
    """Represents a sample movie URL associated with a video."""

    __tablename__ = "video_sample_movie_url"
    __table_args__ = (
        ForeignKeyConstraint(
            ["fk_id"],
            ["public.video.id"],
            ondelete="CASCADE",
        ),
        PrimaryKeyConstraint("id"),
        UniqueConstraint(
            "fk_id",
            "url",
        ),
        Index(None, "fk_id"),
        {"schema": "public", "extend_existing": True},
    )

    url: str = Field(
        sa_column=Column(
            "url",
            Text,
            nullable=False,
        ),
    )
    fk_id: int = Field(
        sa_column=Column(
            "fk_id",
            Integer,
            nullable=False,
        ),
    )
    type: Optional[str] = Field(
        default=None,
        sa_column=Column(
            "type",
            String(50),
        ),
    )

    fk: "Video" = Relationship(back_populates="video_sample_movie_url")

    def __repr__(self) -> str:
        """Return a string representation."""

        return f"VideoSampleMovieUrl(id={self.id!r}, fk_id={self.fk_id!r})"
