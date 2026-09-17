"""Shared SQLAlchemy load and EXISTS helpers for repositories."""

from typing import Optional, Type

from sqlalchemy import Table, exists
from sqlalchemy import select as sa_select
from sqlalchemy.orm import load_only, selectinload
from sqlalchemy.orm.interfaces import LoaderOption
from sqlalchemy.sql import ColumnElement
from sqlmodel import col

from app.models.base import AkaMixin
from app.models.video import Video
from app.utils.query import query_col, relationship_attr


def catalog_load(
    relationship: object,
    *columns: object,
) -> LoaderOption:
    """Select-in load a catalog M2M with only public response columns."""

    return selectinload(relationship_attr(relationship)).load_only(
        *(query_col(column) for column in columns),
    )


def catalog_load_with_aka(
    relationship: object,
    aka_relationship: object,
    aka_model: Type[AkaMixin],
    *columns: object,
) -> LoaderOption:
    """Select-in load a catalog M2M including locale aka rows."""

    return selectinload(relationship_attr(relationship)).options(
        load_only(*(query_col(column) for column in columns)),
        selectinload(relationship_attr(aka_relationship)).load_only(
            query_col(aka_model.id),
            query_col(aka_model.translated_name),
            query_col(aka_model.language),
        ),
    )


def media_load(relationship: object, *columns: object) -> LoaderOption:
    """Select-in load a media 1:N with only public response columns."""

    return selectinload(relationship_attr(relationship)).load_only(
        *(query_col(column) for column in columns),
    )


def exists_link(table: Table, fk_ids: list[int]) -> ColumnElement[bool]:
    """EXISTS subquery: video linked to any of the given catalog ids."""

    return exists(
        sa_select(1)
        .select_from(table)
        .where(
            table.c.video_id == Video.id,
            table.c.fk_id.in_(fk_ids),
        ),
    )


def exists_single(table: Table, fk_id: int) -> ColumnElement[bool]:
    """EXISTS subquery: video linked to one catalog id."""

    return exists(
        sa_select(1)
        .select_from(table)
        .where(
            table.c.video_id == Video.id,
            table.c.fk_id == fk_id,
        ),
    )


def catalog_ids_predicate(
    link_table: Table,
    entity_ids: list[int],
) -> Optional[ColumnElement[bool]]:
    """Video is linked to any of the pre-resolved catalog ids."""

    if not entity_ids:
        return None

    return exists(
        sa_select(1)
        .select_from(link_table)
        .where(
            link_table.c.video_id == col(Video.id),
            link_table.c.fk_id.in_(entity_ids),
        ),
    )


def search_terms(raw: str) -> list[str]:
    """Split ``q`` on ``+`` into non-empty terms; keep spaces inside each term.

    Examples:
    - ``mird+sweat`` → ``["mird", "sweat"]`` (AND across terms)
    - ``aimi yoshikawa+team`` → ``["aimi yoshikawa", "team"]``
      (does not split the actress name on whitespace)
    """

    parts: list[str] = []

    for chunk in raw.split("+"):
        term = chunk.strip()

        if term:
            parts.append(term)

    return parts
