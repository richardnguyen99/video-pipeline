"""Junction tables for video-to-entity many-to-many associations."""

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKeyConstraint,
    Index,
    Integer,
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
        name="video_actress_fk_id_fkey",
    ),
    ForeignKeyConstraint(
        ["video_id"],
        ["public.video.id"],
        ondelete="CASCADE",
        name="video_actress_video_id_fkey",
    ),
    Index(
        "video_actress_fk_id_idx",
        "fk_id",
    ),
    Index(
        "video_actress_video_id_idx",
        "video_id",
    ),
    schema="public",
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
        name="video_director_fk_id_fkey",
    ),
    ForeignKeyConstraint(
        ["video_id"],
        ["public.video.id"],
        ondelete="CASCADE",
        name="video_director_video_id_fkey",
    ),
    Index("video_director_fk_id_idx", "fk_id"),
    Index("video_director_video_id_idx", "video_id"),
    schema="public",
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
        name="video_genre_fk_id_fkey",
    ),
    ForeignKeyConstraint(
        ["video_id"],
        ["public.video.id"],
        ondelete="CASCADE",
        name="video_genre_video_id_fkey",
    ),
    Index("video_genre_fk_id_idx", "fk_id"),
    Index("video_genre_video_id_idx", "video_id"),
    schema="public",
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
        name="video_label_fk_id_fkey",
    ),
    ForeignKeyConstraint(
        ["video_id"],
        ["public.video.id"],
        ondelete="CASCADE",
        name="video_label_video_id_fkey",
    ),
    Index("video_label_fk_id_idx", "fk_id"),
    Index("video_label_video_id_idx", "video_id"),
    schema="public",
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
        name="video_maker_fk_id_fkey",
    ),
    ForeignKeyConstraint(
        ["video_id"],
        ["public.video.id"],
        ondelete="CASCADE",
        name="video_maker_video_id_fkey",
    ),
    Index("video_maker_fk_id_idx", "fk_id"),
    Index("video_maker_video_id_idx", "video_id"),
    schema="public",
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
        name="video_series_fk_id_fkey",
    ),
    ForeignKeyConstraint(
        ["video_id"],
        ["public.video.id"],
        ondelete="CASCADE",
        name="video_series_video_id_fkey",
    ),
    Index("video_series_fk_id_idx", "fk_id"),
    Index("video_series_video_id_idx", "video_id"),
    schema="public",
)
