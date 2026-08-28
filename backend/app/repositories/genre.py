"""Genre data-access layer."""

from typing import Optional

from sqlalchemy.orm import selectinload
from sqlmodel import col, select

from app.models.genre import Genre
from app.repositories.base import BaseRepository
from app.utils.query import _relationship_attr


class GenreRepository(BaseRepository):
    """Read operations for ``Genre`` rows."""

    async def list_genres(self, *, load_aka: bool = False) -> list[Genre]:
        """Return all genres ordered by id ascending.

        Args:
            load_aka: When ``True``, eager-load ``genre_aka`` for locale
                name resolution.

        Returns:
            Genre entities.
        """

        statement = select(Genre).order_by(col(Genre.id).asc())

        if load_aka:
            statement = statement.options(
                selectinload(_relationship_attr(Genre.genre_aka)),
            )

        result = await self.session.exec(statement)

        return list(result.all())

    async def get_by_id(self, genre_id: int) -> Optional[Genre]:
        """Return one genre by primary key with aka rows, or ``None``.

        Args:
            genre_id: Genre primary key.

        Returns:
            Genre with ``genre_aka`` loaded, or ``None`` when missing.
        """

        statement = (
            select(Genre)
            .where(col(Genre.id) == genre_id)
            .options(selectinload(_relationship_attr(Genre.genre_aka)))
        )
        result = await self.session.exec(statement)

        return result.first()
