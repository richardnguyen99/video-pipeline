"""Director data-access layer."""

from typing import Any, Optional

from sqlalchemy import exists, func, or_
from sqlalchemy import select as sa_select
from sqlalchemy.orm import selectinload
from sqlmodel import col, select

from app.models.director import Director, DirectorAka
from app.repositories.base import BaseRepository
from app.utils.common import search_terms
from app.utils.query import relationship_attr


class DirectorRepository(BaseRepository):
    """Read operations for ``Director`` rows."""

    @staticmethod
    def _search_terms(raw: str) -> list[str]:
        """Split ``q`` on ``+`` only; preserve spaces inside each term."""

        return search_terms(raw)

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
            col(DirectorAka.fk_id) == col(Director.id),
            func.lower(col(DirectorAka.translated_name)).like(pattern),
        ]

        if locale_key is not None:
            aka_conditions.append(
                func.lower(col(DirectorAka.language)) == locale_key,
            )

        aka_match = exists(
            sa_select(1).select_from(DirectorAka).where(*aka_conditions),
        )

        return or_(
            func.lower(col(Director.name)).like(pattern),
            col(Director.ruby).ilike(ruby_pattern),
            aka_match,
        )

    def _apply_search(
        self,
        statement: Any,
        q: Optional[str],
        locale_key: Optional[str],
    ) -> Any:
        """AND space-separated terms across searchable director fields."""

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
        """Build the filtered director select without pagination."""

        statement = select(Director)
        statement = self._apply_search(statement, q, locale_key)

        return statement

    async def list_directors(
        self,
        *,
        q: Optional[str] = None,
        locale_key: Optional[str] = None,
        load_aka: bool = False,
        limit: int = 20,
        offset: int = 0,
    ) -> list[Director]:
        """Return a page of directors ordered by id.

        Args:
            q: Optional multi-term search string.
            locale_key: When set, aka search is scoped to this language.
            load_aka: When ``True``, eager-load ``director_aka``.
            limit: Maximum rows to return.
            offset: Rows to skip.

        Returns:
            Director entities for the requested page.
        """

        statement = self._base_list_statement(q=q, locale_key=locale_key)
        statement = statement.order_by(col(Director.id).asc())
        statement = statement.offset(offset).limit(limit)

        if load_aka:
            statement = statement.options(
                selectinload(relationship_attr(Director.director_aka)),
            )

        result = await self.session.exec(statement)

        return list(result.all())

    async def count_directors(
        self,
        *,
        q: Optional[str] = None,
        locale_key: Optional[str] = None,
    ) -> int:
        """Return total directors matching the same filters as list.

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

    async def get_by_id(self, director_id: int) -> Optional[Director]:
        """Return one director by primary key with aka rows, or ``None``.

        Args:
            director_id: Director primary key.

        Returns:
            Director with ``director_aka`` loaded, or ``None`` when missing.
        """

        statement = (
            select(Director)
            .where(col(Director.id) == director_id)
            .options(selectinload(relationship_attr(Director.director_aka)))
        )
        result = await self.session.exec(statement)

        return result.first()
