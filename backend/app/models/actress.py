"""Actress-related SQLModel models."""

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

from app.models.associations import t_video_actress
from app.models.base import IdTimestampMixin

if TYPE_CHECKING:
    from app.models.user_actress_subscribe import UserActressSubscribe
    from app.models.video import Video


class Actress(IdTimestampMixin, table=True):
    """Represents an actress entity."""

    __table_args__ = (
        PrimaryKeyConstraint("id", name="actress_pkey"),
        UniqueConstraint("dmm_id", name="uq_actress_dmm_id"),
        Index(
            "actress_dmm_name_gin_idx",
            "name",
            postgresql_ops={"name": "gin_trgm_ops"},
            postgresql_using="gin",
        ),
        {"schema": "public"},
    )

    name: str = Field(
        sa_column=Column(
            "name",
            String(255),
            nullable=False,
        ),
    )
    url: Optional[str] = Field(
        default=None,
        sa_column=Column(
            "url",
            Text,
        ),
    )
    image_url: Optional[str] = Field(
        default=None,
        sa_column=Column(
            "image_url",
            Text,
        ),
    )
    scraped_at: Optional[datetime.datetime] = Field(
        default=None,
        sa_column=Column(
            "scraped_at",
            DateTime,
        ),
    )
    original_name: Optional[str] = Field(
        default=None,
        sa_column=Column(
            "original_name",
            String(255),
        ),
    )
    dmm_id: Optional[str] = Field(
        default=None,
        sa_column=Column(
            "dmm_id",
            String(50),
        ),
    )
    dmm_name: Optional[str] = Field(
        default=None,
        sa_column=Column(
            "dmm_name",
            String(255),
        ),
    )
    ruby: Optional[str] = Field(
        default=None,
        sa_column=Column(
            "ruby",
            String(255),
        ),
    )
    bust: Optional[int] = Field(
        default=None,
        sa_column=Column(
            "bust",
            Integer,
        ),
    )
    cup: Optional[str] = Field(
        default=None,
        sa_column=Column(
            "cup",
            String(10),
        ),
    )
    waist: Optional[int] = Field(
        default=None,
        sa_column=Column(
            "waist",
            Integer,
        ),
    )
    hip: Optional[int] = Field(
        default=None,
        sa_column=Column(
            "hip",
            Integer,
        ),
    )
    height: Optional[int] = Field(
        default=None,
        sa_column=Column(
            "height",
            Integer,
        ),
    )
    birthday: Optional[str] = Field(
        default=None,
        sa_column=Column(
            "birthday",
            String(20),
        ),
    )
    blood_type: Optional[str] = Field(
        default=None,
        sa_column=Column(
            "blood_type",
            String(5),
        ),
    )
    hobby: Optional[str] = Field(
        default=None,
        sa_column=Column(
            "hobby",
            Text,
        ),
    )
    prefectures: Optional[str] = Field(
        default=None,
        sa_column=Column(
            "prefectures",
            String(100),
        ),
    )
    populated_at: Optional[datetime.datetime] = Field(
        default=None,
        sa_column=Column(
            "populated_at",
            DateTime,
        ),
    )

    actress_aka: "ActressAka" = Relationship(
        back_populates="fk",
        sa_relationship_kwargs={"uselist": False},
    )
    actress_image: list["ActressImage"] = Relationship(back_populates="fk")
    videos: list["Video"] = Relationship(
        back_populates="actresses",
        sa_relationship_kwargs={"secondary": t_video_actress},
    )
    subscribers: list["UserActressSubscribe"] = Relationship(
        back_populates="actress",
    )

    def __repr__(self) -> str:
        """Return a string representation."""

        return f"Actress(id={self.id!r}, name={self.name!r})"


class ActressAka(IdTimestampMixin, table=True):
    """Represents an alternative name (aka) for an actress."""

    __tablename__ = "actress_aka"
    __table_args__ = (
        ForeignKeyConstraint(
            ["fk_id"],
            ["public.actress.id"],
            ondelete="CASCADE",
            name="actress_aka_fk_id_fkey",
        ),
        PrimaryKeyConstraint("id", name="actress_aka_pkey"),
        UniqueConstraint("fk_id", name="uq_actress_aka_fk_id"),
        {"schema": "public"},
    )

    name: str = Field(
        sa_column=Column(
            "name",
            Text,
            nullable=False,
        ),
    )
    translated_name: str = Field(
        sa_column=Column(
            "translated_name",
            String(255),
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
    fk_id: int = Field(
        sa_column=Column(
            "fk_id",
            Integer,
            nullable=False,
        ),
    )

    fk: "Actress" = Relationship(back_populates="actress_aka")

    def __repr__(self) -> str:
        """Return a string representation."""

        return f"ActressAka(id={self.id!r}, fk_id={self.fk_id!r})"


class ActressImage(IdTimestampMixin, table=True):
    """Represents an image associated with an actress."""

    __tablename__ = "actress_image"
    __table_args__ = (
        ForeignKeyConstraint(
            ["fk_id"],
            ["public.actress.id"],
            ondelete="CASCADE",
            name="actress_image_actress_id_fkey",
        ),
        PrimaryKeyConstraint("id", name="actress_image_pkey"),
        UniqueConstraint(
            "fk_id",
            "attribute",
            name="uq_actress_image_fk_id_attribute",
        ),
        Index("actress_image_fk_id_idx", "fk_id"),
        {"schema": "public"},
    )

    url: str = Field(
        sa_column=Column(
            "url",
            Text,
            nullable=False,
        ),
    )
    attribute: int = Field(
        sa_column=Column(
            "attribute",
            Integer,
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

    fk: "Actress" = Relationship(back_populates="actress_image")

    def __repr__(self) -> str:
        """Return a string representation."""

        return f"ActressImage(id={self.id!r}, fk_id={self.fk_id!r})"
