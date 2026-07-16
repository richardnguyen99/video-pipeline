"""Series-related SQLModel models."""

import datetime
from typing import Optional

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
    text,
)
from sqlmodel import Field, Relationship, SQLModel


class Series(SQLModel, table=True):
    """Represents a series entity."""

    __table_args__ = (
        PrimaryKeyConstraint("id", name="series_pkey"),
        UniqueConstraint("dmm_id", name="series_dmm_id_key"),
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
    scraped_at: datetime.datetime = Field(
        sa_column=Column(
            "scraped_at",
            DateTime,
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
    dmm_id: str = Field(
        sa_column=Column(
            "dmm_id",
            String(50),
            nullable=False,
        ),
    )
    ruby: Optional[str] = Field(
        default=None,
        sa_column=Column(
            "ruby",
            String(255),
        ),
    )

    series_aka: list["SeriesAka"] = Relationship(back_populates="fk")

    def __repr__(self) -> str:
        """Return a string representation."""

        return f"Series(id={self.id!r}, name={self.name!r})"


class SeriesAka(SQLModel, table=True):
    """Represents an alternative name (aka) for a series."""

    __tablename__ = "series_aka"
    __table_args__ = (
        ForeignKeyConstraint(
            columns=["fk_id"],
            refcolumns=["public.series.id"],
            ondelete="CASCADE",
            name="series_aka_fk_id_fkey",
        ),
        PrimaryKeyConstraint("id", name="series_aka_pkey"),
        UniqueConstraint(
            "fk_id",
            "language",
            name="uq_series_aka_fk_id_language",
        ),
        Index("series_aka_fk_id_idx", "fk_id"),
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
    fk_id: int = Field(
        sa_column=Column(
            "fk_id",
            Integer,
            nullable=False,
        ),
    )

    fk: "Series" = Relationship(back_populates="series_aka")

    def __repr__(self) -> str:
        """Return a string representation."""

        return f"SeriesAka(id={self.id!r}, fk_id={self.fk_id!r})"
