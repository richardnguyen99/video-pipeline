"""Actress data-access repository."""

from sqlalchemy.orm import selectinload
from sqlmodel import col, func, select

from app.models.actress import Actress, ActressAka, ActressImage
from app.repositories.base import BaseRepository
from app.utils import _col, _relationship_attr


class ActressRepository(BaseRepository):
    """Read operations for ``Actress`` rows."""

    async def list_actresses(
        self,
        *,
        limit: int = 20,
        offset: int = 0,
    ) -> list[Actress]:
        """Return a page of actresses with aka and images loaded.

        ``selectinload`` avoids cartesian products; ``load_only`` limits
        columns to those exposed by the public schemas.

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
                selectinload(
                    _relationship_attr(Actress.actress_aka),
                ).load_only(
                    _col(ActressAka.id),
                    _col(ActressAka.name),
                    _col(ActressAka.translated_name),
                ),
                selectinload(
                    _relationship_attr(Actress.actress_image),
                ).load_only(
                    _col(ActressImage.id),
                    _col(ActressImage.url),
                    _col(ActressImage.attribute),
                ),
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
