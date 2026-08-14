"""Query attribute cast helpers for SQLModel/SQLAlchemy type narrowing."""

from typing import Any, cast

from sqlalchemy.orm import QueryableAttribute


def _relationship_attr(attribute: Any) -> QueryableAttribute[Any]:
    """Narrow a SQLModel relationship to a ``QueryableAttribute`` for mypy."""

    return cast(QueryableAttribute[Any], attribute)


def _col(attribute: Any) -> QueryableAttribute[Any]:
    """Narrow a SQLModel column to a ``QueryableAttribute`` for mypy."""

    return cast(QueryableAttribute[Any], attribute)
