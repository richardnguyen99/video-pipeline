"""Junction tables for video-to-entity many-to-many associations."""

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKeyConstraint,
    Index,
    Integer,
    PrimaryKeyConstraint,
    Table,
    text,
)
from sqlmodel import SQLModel

t_video_actress = Table(
    "video_actress",
    SQLModel.metadata,
    Column(
        "video_id",
        Integer,
        nullable=False,
    ),
    Column(
        "created_at",
        DateTime,
        nullable=False,
        server_default=text("now()"),
    ),
    Column(
        "updated_at",
        DateTime,
        nullable=False,
        server_default=text("now()"),
    ),
    Column(
        "fk_id",
        Integer,
        nullable=False,
    ),
    ForeignKeyConstraint(
        ["fk_id"],
        ["public.actress.id"],
        ondelete="CASCADE",
    ),
    ForeignKeyConstraint(
        ["video_id"],
        ["public.video.id"],
        ondelete="CASCADE",
    ),
    PrimaryKeyConstraint(
        "video_id",
        "fk_id",
    ),
    Index(
        None,
        "fk_id",
    ),
    Index(
        None,
        "video_id",
    ),
    schema="public",
    extend_existing=True,
)


t_video_director = Table(
    "video_director",
    SQLModel.metadata,
    Column(
        "video_id",
        Integer,
        nullable=False,
    ),
    Column(
        "created_at",
        DateTime,
        nullable=False,
        server_default=text("now()"),
    ),
    Column(
        "updated_at",
        DateTime,
        nullable=False,
        server_default=text("now()"),
    ),
    Column(
        "fk_id",
        Integer,
        nullable=False,
    ),
    ForeignKeyConstraint(
        ["fk_id"],
        ["public.director.id"],
        ondelete="CASCADE",
    ),
    ForeignKeyConstraint(
        ["video_id"],
        ["public.video.id"],
        ondelete="CASCADE",
    ),
    Index(None, "fk_id"),
    Index(None, "video_id"),
    schema="public",
    extend_existing=True,
)


t_video_genre = Table(
    "video_genre",
    SQLModel.metadata,
    Column(
        "video_id",
        Integer,
        nullable=False,
    ),
    Column(
        "created_at",
        DateTime,
        nullable=False,
        server_default=text("now()"),
    ),
    Column(
        "updated_at",
        DateTime,
        nullable=False,
        server_default=text("now()"),
    ),
    Column(
        "fk_id",
        Integer,
        nullable=False,
    ),
    ForeignKeyConstraint(
        ["fk_id"],
        ["public.genre.id"],
        ondelete="CASCADE",
    ),
    ForeignKeyConstraint(
        ["video_id"],
        ["public.video.id"],
        ondelete="CASCADE",
    ),
    Index(None, "fk_id"),
    Index(None, "video_id"),
    schema="public",
    extend_existing=True,
)


t_video_label = Table(
    "video_label",
    SQLModel.metadata,
    Column(
        "video_id",
        Integer,
        nullable=False,
    ),
    Column(
        "created_at",
        DateTime,
        nullable=False,
        server_default=text("now()"),
    ),
    Column(
        "updated_at",
        DateTime,
        nullable=False,
        server_default=text("now()"),
    ),
    Column(
        "fk_id",
        Integer,
        nullable=False,
    ),
    ForeignKeyConstraint(
        ["fk_id"],
        ["public.label.id"],
        ondelete="CASCADE",
    ),
    ForeignKeyConstraint(
        ["video_id"],
        ["public.video.id"],
        ondelete="CASCADE",
    ),
    Index(None, "fk_id"),
    Index(None, "video_id"),
    schema="public",
    extend_existing=True,
)


t_video_maker = Table(
    "video_maker",
    SQLModel.metadata,
    Column(
        "video_id",
        Integer,
        nullable=False,
    ),
    Column(
        "created_at",
        DateTime,
        nullable=False,
        server_default=text("now()"),
    ),
    Column(
        "updated_at",
        DateTime,
        nullable=False,
        server_default=text("now()"),
    ),
    Column(
        "fk_id",
        Integer,
        nullable=False,
    ),
    ForeignKeyConstraint(
        ["fk_id"],
        ["public.maker.id"],
        ondelete="CASCADE",
    ),
    ForeignKeyConstraint(
        ["video_id"],
        ["public.video.id"],
        ondelete="CASCADE",
    ),
    Index(None, "fk_id"),
    Index(None, "video_id"),
    schema="public",
    extend_existing=True,
)


t_video_series = Table(
    "video_series",
    SQLModel.metadata,
    Column(
        "video_id",
        Integer,
        nullable=False,
    ),
    Column(
        "created_at",
        DateTime,
        nullable=False,
        server_default=text("now()"),
    ),
    Column(
        "updated_at",
        DateTime,
        nullable=False,
        server_default=text("now()"),
    ),
    Column(
        "fk_id",
        Integer,
        nullable=False,
    ),
    ForeignKeyConstraint(
        ["fk_id"],
        ["public.series.id"],
        ondelete="CASCADE",
    ),
    ForeignKeyConstraint(
        ["video_id"],
        ["public.video.id"],
        ondelete="CASCADE",
    ),
    Index(None, "fk_id"),
    Index(None, "video_id"),
    schema="public",
    extend_existing=True,
)
