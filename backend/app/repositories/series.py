"""Series data-access layer."""

from typing import Any, Optional

from sqlalchemy import exists, func, or_
from sqlalchemy import select as sa_select
from sqlalchemy.orm import selectinload
from sqlmodel import col, select

from app.models.series import Series, SeriesAka
from app.repositories.base import BaseRepository
from app.utils.query import _relationship_attr


class SeriesRepository(BaseRepository):
    """Read operations for ``Series`` rows."""

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

        When ``locale_key`` is set, aka matches are limited to that language.
        """

        pattern = f"%{term.lower()}%"
        ruby_pattern = f"%{term}%"

        aka_conditions: list[Any] = [
            col(SeriesAka.fk_id) == col(Series.id),
            func.lower(col(SeriesAka.translated_name)).like(pattern),
        ]

        if locale_key is not None:
            aka_conditions.append(
                func.lower(col(SeriesAka.language)) == locale_key,
            )

        aka_match = exists(
            sa_select(1).select_from(SeriesAka).where(*aka_conditions),
        )

        return or_(
            func.lower(col(Series.name)).like(pattern),
            col(Series.ruby).ilike(ruby_pattern),
            aka_match,
        )

    def _apply_search(
        self,
        statement: Any,
        q: Optional[str],
        locale_key: Optional[str],
    ) -> Any:
        """AND space-separated terms across searchable series fields."""

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
        """Build the filtered series select without pagination."""

        statement = select(Series)
        statement = self._apply_search(statement, q, locale_key)

        return statement

    async def list_series(
        self,
        *,
        q: Optional[str] = None,
        locale_key: Optional[str] = None,
        load_aka: bool = False,
        limit: int = 20,
        offset: int = 0,
    ) -> list[Series]:
        """Return a page of series ordered by id.

        Args:
            q: Optional multi-term search string.
            locale_key: When set, aka search is scoped to this language.
            load_aka: When ``True``, eager-load ``series_aka``.
            limit: Maximum rows to return.
            offset: Rows to skip.

        Returns:
            Series entities for the requested page.
        """

        statement = self._base_list_statement(q=q, locale_key=locale_key)
        statement = statement.order_by(col(Series.id).asc())
        statement = statement.offset(offset).limit(limit)

        if load_aka:
            statement = statement.options(
                selectinload(_relationship_attr(Series.series_aka)),
            )

        result = await self.session.exec(statement)

        return list(result.all())

    async def count_series(
        self,
        *,
        q: Optional[str] = None,
        locale_key: Optional[str] = None,
    ) -> int:
        """Return total series matching the same filters as list.

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

    async def get_by_id(self, series_id: int) -> Optional[Series]:
        """Return one series by primary key with aka rows, or ``None``.

        Args:
            series_id: Series primary key.

        Returns:
            Series with ``series_aka`` loaded, or ``None`` when missing.
        """

        statement = (
            select(Series)
            .where(col(Series.id) == series_id)
            .options(selectinload(_relationship_attr(Series.series_aka)))
        )
        result = await self.session.exec(statement)

        return result.first()
