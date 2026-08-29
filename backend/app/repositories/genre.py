"""Genre data-access layer."""

from typing import Any, Optional

from sqlalchemy import exists, func, or_
from sqlalchemy import select as sa_select
from sqlalchemy.orm import selectinload
from sqlmodel import col, select

from app.models.genre import Genre, GenreAka
from app.repositories.base import BaseRepository
from app.utils.query import _relationship_attr


class GenreRepository(BaseRepository):
    """Read operations for ``Genre`` rows."""

    @staticmethod
    def _search_terms(raw: str) -> list[str]:
        """Split a search string into non-empty space-separated terms."""

        return [part for part in raw.strip().split() if part]

    @staticmethod
    def _term_match_predicate(
        term: str,
        locale_key: Optional[str],
    ) -> Any:
        """Match one term against name, ruby, and aka translations.

        When ``locale_key`` is set, aka matches are limited to that language
        so search aligns with the translated display name.
        """

        pattern = f"%{term.lower()}%"
        ruby_pattern = f"%{term}%"

        aka_conditions: list[Any] = [
            col(GenreAka.fk_id) == col(Genre.id),
            func.lower(col(GenreAka.translated_name)).like(pattern),
        ]

        if locale_key is not None:
            aka_conditions.append(
                func.lower(col(GenreAka.language)) == locale_key,
            )

        aka_match = exists(
            sa_select(1).select_from(GenreAka).where(*aka_conditions),
        )

        return or_(
            func.lower(col(Genre.name)).like(pattern),
            col(Genre.ruby).ilike(ruby_pattern),
            aka_match,
        )

    def _apply_search(
        self,
        statement: Any,
        q: Optional[str],
        locale_key: Optional[str],
    ) -> Any:
        """AND space-separated terms across searchable genre fields."""

        if q is None or q.strip() == "":
            return statement

        terms = self._search_terms(q)

        if not terms:
            return statement

        for term in terms:
            statement = statement.where(
                self._term_match_predicate(term, locale_key),
            )

        return statement

    def _base_list_statement(
        self,
        *,
        q: Optional[str],
        locale_key: Optional[str],
    ) -> Any:
        """Build the filtered genre select without pagination."""

        statement = select(Genre)
        statement = self._apply_search(statement, q, locale_key)

        return statement

    async def list_genres(
        self,
        *,
        q: Optional[str] = None,
        locale_key: Optional[str] = None,
        load_aka: bool = False,
        limit: int = 20,
        offset: int = 0,
    ) -> list[Genre]:
        """Return a page of genres ordered by id.

        Args:
            q: Optional multi-term search string.
            locale_key: When set, aka search is scoped to this language.
            load_aka: When ``True``, eager-load ``genre_aka``.
            limit: Maximum rows to return.
            offset: Rows to skip.

        Returns:
            Genre entities for the requested page.
        """

        statement = self._base_list_statement(q=q, locale_key=locale_key)
        statement = statement.order_by(col(Genre.id).asc())
        statement = statement.offset(offset).limit(limit)

        if load_aka:
            statement = statement.options(
                selectinload(_relationship_attr(Genre.genre_aka)),
            )

        result = await self.session.exec(statement)

        return list(result.all())

    async def count_genres(
        self,
        *,
        q: Optional[str] = None,
        locale_key: Optional[str] = None,
    ) -> int:
        """Return total genres matching the same filters as list.

        Args:
            q: Optional multi-term search string.
            locale_key: When set, aka search is scoped to this language.

        Returns:
            Total matching row count.
        """

        statement = self._base_list_statement(q=q, locale_key=locale_key)
        count_statement = sa_select(func.count()).select_from(
            statement.subquery(),
        )
        result = await self.session.execute(count_statement)
        total = result.scalar_one()

        return int(total)

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
