"""Actress data-access repository."""

from typing import Any, cast

from sqlalchemy.orm import QueryableAttribute, selectinload
from sqlmodel import col, func, select

from app.models.actress import Actress
from app.repositories.base import BaseRepository


def _relationship_attr(attribute: Any) -> QueryableAttribute[Any]:
    """Narrow a SQLModel relationship to a ``QueryableAttribute`` for mypy."""

    return cast(QueryableAttribute[Any], attribute)


class ActressRepository(BaseRepository):
    """Read operations for ``Actress`` rows."""

    async def list_actresses(
        self,
        *,
        limit: int = 20,
        offset: int = 0,
    ) -> list[Actress]:
        """Return a page of actresses with aka and images loaded.

        Args:
            limit: Maximum rows to return.
            offset: Number of rows to skip.

        Returns:
            Matching ``Actress`` instances with ``actress_aka`` and
            ``actress_image`` populated.
        """

        statement = (
            select(Actress)
            .options(
                selectinload(_relationship_attr(Actress.actress_aka)),
                selectinload(_relationship_attr(Actress.actress_image)),
            )
            .order_by(col(Actress.id))
            .offset(offset)
            .limit(limit)
        )
        result = await self.session.exec(statement)

        return list(result.all())

    async def count_actresses(self) -> int:
        """Return the total number of actress rows."""

        statement = select(func.count()).select_from(Actress)
        result = await self.session.exec(statement)
        total = result.one()

        return int(total)
