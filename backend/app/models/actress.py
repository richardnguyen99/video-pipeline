"""Actress-related SQLModel models."""

import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKeyConstraint,
    Index,
    Integer,
    PrimaryKeyConstraint,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlmodel import Field, Relationship, SQLModel


class Actress(SQLModel, table=True):
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

    id: int = Field(
        sa_column=Column(
            "id",
            Integer,
            primary_key=True,
            autoincrement=True,
        ),
    )
    name: str = Field(
        sa_column=Column(
            "name",
            String(255),
            nullable=False,
        ),
    )
    created_at: datetime.datetime = Field(
        sa_column=Column(
            "created_at",
            DateTime,
            nullable=False,
            server_default=text("now()"),
        ),
    )
    updated_at: datetime.datetime = Field(
        sa_column=Column(
            "updated_at",
            DateTime,
            nullable=False,
            server_default=text("now()"),
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

    def __repr__(self) -> str:
        """Return a string representation."""
        return f"Actress(id={self.id!r}, name={self.name!r})"


class ActressScrape(SQLModel, table=True):
    """Represents a raw actress scrape record."""

    __tablename__ = "actress_scrape"
    __table_args__ = (
        PrimaryKeyConstraint("id", name="actress_scrape_pkey"),
        UniqueConstraint("actress_page", "index_on_page", name="ux_actress_page_index"),
        {"schema": "public"},
    )

    id: int = Field(
        sa_column=Column("id", Integer, primary_key=True, autoincrement=True)
    )
    name: str = Field(sa_column=Column("name", String(255), nullable=False))
    actress_page: int = Field(sa_column=Column("actress_page", Integer, nullable=False))
    index_on_page: int = Field(
        sa_column=Column("index_on_page", Integer, nullable=False)
    )
    stored: bool = Field(
        sa_column=Column(
            "stored", Boolean, nullable=False, server_default=text("false")
        )
    )
    created_at: datetime.datetime = Field(
        sa_column=Column(
            "created_at",
            DateTime,
            nullable=False,
            server_default=text("now()"),
        )
    )
    updated_at: datetime.datetime = Field(
        sa_column=Column(
            "updated_at",
            DateTime,
            nullable=False,
            server_default=text("now()"),
        )
    )
    dmm_id: Optional[str] = Field(
        default=None,
        sa_column=Column(
            "dmm_id",
            String(255),
        ),
    )

    def __repr__(self) -> str:
        """Return a string representation."""

        return f"ActressScrape(id={self.id!r}, name={self.name!r})"


class ActressScrapeErrorPage(SQLModel, table=True):
    """Represents an actress scrape error page record."""

    __tablename__ = "actress_scrape_error_page"
    __table_args__ = (
        PrimaryKeyConstraint("id", name="actress_scrape_error_page_pkey"),
        UniqueConstraint(
            "actress_id",
            "page_num",
            name="ux_actress_id_page_num",
        ),
        {"schema": "public"},
    )

    id: int = Field(
        sa_column=Column("id", Integer, primary_key=True, autoincrement=True)
    )
    actress_id: int = Field(
        sa_column=Column(
            "actress_id",
            Integer,
            nullable=False,
        ),
    )
    page_num: int = Field(
        sa_column=Column(
            "page_num",
            Integer,
            nullable=False,
        ),
    )
    error_code: str = Field(
        sa_column=Column(
            "error_code",
            String(255),
            nullable=False,
        ),
    )
    created_at: datetime.datetime = Field(
        sa_column=Column(
            "created_at",
            DateTime,
            nullable=False,
            server_default=text("now()"),
        )
    )
    updated_at: datetime.datetime = Field(
        sa_column=Column(
            "updated_at",
            DateTime,
            nullable=False,
            server_default=text("now()"),
        )
    )

    def __repr__(self) -> str:
        """Return a string representation."""

        return f"ActressScrapeErrorPage(id={self.id!r})"


class ActressAka(SQLModel, table=True):
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

    id: int = Field(
        sa_column=Column(
            "id",
            Integer,
            primary_key=True,
            autoincrement=True,
        )
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
    created_at: datetime.datetime = Field(
        sa_column=Column(
            "created_at",
            DateTime,
            nullable=False,
            server_default=text("now()"),
        )
    )
    updated_at: datetime.datetime = Field(
        sa_column=Column(
            "updated_at",
            DateTime,
            nullable=False,
            server_default=text("now()"),
        )
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


class ActressImage(SQLModel, table=True):
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

    id: int = Field(
        sa_column=Column(
            "id",
            Integer,
            primary_key=True,
            autoincrement=True,
        ),
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
    created_at: datetime.datetime = Field(
        sa_column=Column(
            "created_at",
            DateTime,
            nullable=False,
            server_default=text("now()"),
        )
    )
    updated_at: datetime.datetime = Field(
        sa_column=Column(
            "updated_at",
            DateTime,
            nullable=False,
            server_default=text("now()"),
        )
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
