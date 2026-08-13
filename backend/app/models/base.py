"""Shared SQLModel mixins for common column patterns.

Avoid ``sa_column=Column(...)`` on mixins: a single ``Column`` instance can
only belong to one ``Table``. Prefer ``max_length`` / ``sa_column_kwargs`` so
each mapped subclass gets its own columns.

Avoid ``sa_type=String(n)``: mypy expects ``type[Any]``, not a TypeEngine
instance. Use ``max_length`` for varchar-like fields instead.
"""

import datetime
from typing import Any, Optional, cast

from sqlalchemy import Text, text
from sqlmodel import Field, SQLModel


class IdMixin(SQLModel):
    """Integer primary key with autoincrement."""

    id: int = Field(primary_key=True)


class TimestampMixin(SQLModel):
    """created_at / updated_at with DB server defaults."""

    created_at: datetime.datetime = Field(
        nullable=False,
        sa_column_kwargs={"server_default": text("now()")},
    )
    updated_at: datetime.datetime = Field(
        nullable=False,
        sa_column_kwargs={"server_default": text("now()")},
    )


class IdTimestampMixin(IdMixin, TimestampMixin):
    """Convenience: id + created_at + updated_at."""


class DmmCatalogMixin(IdTimestampMixin):
    """Shared fields for DMM catalog entities.

    Used by Maker, Label, Director, Genre, Series:
    name, scraped_at, dmm_id, ruby (+ id / timestamps from parent).
    """

    name: str = Field(max_length=255)
    scraped_at: datetime.datetime = Field(nullable=False)
    dmm_id: str = Field(max_length=50)
    ruby: Optional[str] = Field(default=None, max_length=255)


class AkaMixin(IdTimestampMixin):
    """Shared fields for *Aka translation tables.

    Used by MakerAka, LabelAka, DirectorAka, GenreAka, SeriesAka:
    translated_name, language, name_type, fk_id (+ id / timestamps).
    """

    translated_name: str = Field(
        sa_type=cast(type[Any], Text),
    )
    language: str = Field(max_length=10)
    name_type: str = Field(max_length=20)
    fk_id: int = Field(nullable=False)
