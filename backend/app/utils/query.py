"""Query attribute cast helpers for SQLModel/SQLAlchemy type narrowing."""

from typing import TypeVar, cast

from sqlalchemy.orm import QueryableAttribute

_T = TypeVar("_T")


def relationship_attr(attribute: _T) -> QueryableAttribute[object]:
    """Narrow a SQLModel relationship to a ``QueryableAttribute`` for mypy."""

    return cast(QueryableAttribute[object], attribute)


def query_col(attribute: _T) -> QueryableAttribute[object]:
    """Narrow a SQLModel column to a ``QueryableAttribute`` for mypy."""

    return cast(QueryableAttribute[object], attribute)
