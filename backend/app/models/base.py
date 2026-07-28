"""Shared SQLModel mixins for common column patterns."""

import datetime
from typing import Optional

from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.sql.functions import now
from sqlmodel import Field, SQLModel


class IdMixin(SQLModel):
    """Integer primary key with autoincrement."""

    id: int = Field(
        sa_column=Column(
            "id",
            Integer,
            primary_key=True,
            autoincrement=True,
        ),
    )


class TimestampMixin(SQLModel):
    """created_at / updated_at with DB server defaults."""

    created_at: datetime.datetime = Field(
        sa_column=Column(
            "created_at", DateTime, nullable=False, server_default=now()
        ),
    )
    updated_at: datetime.datetime = Field(
        sa_column=Column(
            "updated_at", DateTime, nullable=False, server_default=now()
        ),
    )


class IdTimestampMixin(IdMixin, TimestampMixin):
    """Convenience: id + created_at + updated_at."""


class DmmCatalogMixin(IdTimestampMixin):
    """Shared fields for DMM catalog entities.

    Used by Maker, Label, Director, Genre, Series:
    name, scraped_at, dmm_id, ruby (+ id / timestamps from parent).
    """

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


class AkaMixin(IdTimestampMixin):
    """Shared fields for *Aka translation tables.

    Used by MakerAka, LabelAka, DirectorAka, GenreAka, SeriesAka:
    translated_name, language, name_type, fk_id (+ id / timestamps).
    """

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
    fk_id: int = Field(
        sa_column=Column(
            "fk_id",
            Integer,
            nullable=False,
        ),
    )
