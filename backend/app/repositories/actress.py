"""Actress data-access repository."""

from typing import Any, ClassVar, Optional

from sqlalchemy import Date, cast, exists, func
from sqlalchemy import select as sa_select
from sqlalchemy.orm import selectinload
from sqlmodel import col, select

from app.models.actress import Actress, ActressAka, ActressImage
from app.models.associations import (
    t_video_actress,
    t_video_director,
    t_video_genre,
    t_video_label,
    t_video_maker,
    t_video_series,
)
from app.models.user_actress_subscribe import UserActressSubscribe
from app.models.video_view import VideoView
from app.repositories.base import BaseRepository
from app.schemas.actress_filters import ActressListFilters, ActressSort
from app.utils import _col, _relationship_attr


class ActressRepository(BaseRepository):
    """Read operations for ``Actress`` rows."""

    @staticmethod
    def _birthday_as_date() -> Any:
        """Cast stored birthday text to a SQL date for age math."""

        return cast(col(Actress.birthday), Date)

    @classmethod
    def _age_expr(cls) -> Any:
        """Years between birthday and current date."""

        return func.date_part(
            "year",
            func.age(func.current_date(), cls._birthday_as_date()),
        )

    @staticmethod
    def _apply_filters(
        statement: Any,
        filters: Optional[ActressListFilters],
    ) -> Any:
        """Apply AND-combined filters; multi-value fields use OR."""

        if filters is None:
            return statement

        if filters.cups:
            cups = [cup.strip().upper() for cup in filters.cups if cup.strip()]

            if cups:
                statement = statement.where(
                    func.upper(col(Actress.cup)).in_(cups),
                )

        statement = ActressRepository._apply_range(
            statement,
            col(Actress.bust),
            filters.bust_min,
            filters.bust_max,
        )
        statement = ActressRepository._apply_range(
            statement,
            col(Actress.waist),
            filters.waist_min,
            filters.waist_max,
        )
        statement = ActressRepository._apply_range(
            statement,
            col(Actress.hip),
            filters.hip_min,
            filters.hip_max,
        )
        statement = ActressRepository._apply_range(
            statement,
            col(Actress.height),
            filters.height_min,
            filters.height_max,
        )

        if filters.age_min is not None or filters.age_max is not None:
            statement = statement.where(col(Actress.birthday).is_not(None))
            statement = ActressRepository._apply_range(
                statement,
                ActressRepository._age_expr(),
                filters.age_min,
                filters.age_max,
            )

        if filters.genres:
            statement = statement.where(
                ActressRepository._exists_video_link(
                    t_video_genre,
                    filters.genres,
                ),
            )

        if filters.makers:
            statement = statement.where(
                ActressRepository._exists_video_link(
                    t_video_maker,
                    filters.makers,
                ),
            )

        if filters.series:
            statement = statement.where(
                ActressRepository._exists_video_link(
                    t_video_series,
                    filters.series,
                ),
            )

        if filters.labels:
            statement = statement.where(
                ActressRepository._exists_video_link(
                    t_video_label,
                    filters.labels,
                ),
            )

        if filters.directors:
            statement = statement.where(
                ActressRepository._exists_video_link(
                    t_video_director,
                    filters.directors,
                ),
            )

        return statement

    @staticmethod
    def _apply_range(
        statement: Any,
        column: Any,
        minimum: Optional[int],
        maximum: Optional[int],
    ) -> Any:
        """Restrict ``column`` to an inclusive numeric range."""

        if minimum is not None:
            statement = statement.where(column >= minimum)

        if maximum is not None:
            statement = statement.where(column <= maximum)

        return statement

    @staticmethod
    def _exists_video_link(table: Any, fk_ids: list[int]) -> Any:
        """Actress features a video linked to any of the given catalog ids."""

        return exists(
            sa_select(1)
            .select_from(t_video_actress)
            .join(
                table,
                table.c.video_id == t_video_actress.c.video_id,
            )
            .where(
                t_video_actress.c.fk_id == Actress.id,
                table.c.fk_id.in_(fk_ids),
            ),
        )

    _measurement_sort_columns: ClassVar[dict[ActressSort, Any] | None] = None
    _aggregate_sort_exprs: ClassVar[dict[ActressSort, Any] | None] = None

    @classmethod
    def _get_measurement_sort_columns(cls) -> dict[ActressSort, Any]:
        """Return measurement sort columns (built once per process)."""

        if cls._measurement_sort_columns is None:
            cls._measurement_sort_columns = {
                ActressSort.CUP: col(Actress.cup),
                ActressSort.BUST: col(Actress.bust),
                ActressSort.WAIST: col(Actress.waist),
                ActressSort.HIP: col(Actress.hip),
                ActressSort.HEIGHT: col(Actress.height),
            }

        return cls._measurement_sort_columns

    @classmethod
    def _get_aggregate_sort_exprs(cls) -> dict[ActressSort, Any]:
        """Return aggregate sort subqueries (built once per process)."""

        if cls._aggregate_sort_exprs is None:
            cls._aggregate_sort_exprs = {
                ActressSort.VIDEO_CNT: (
                    sa_select(func.count())
                    .where(t_video_actress.c.fk_id == Actress.id)
                    .correlate(Actress)
                    .scalar_subquery()
                ),
                ActressSort.SUB_CNT: (
                    sa_select(func.count())
                    .select_from(UserActressSubscribe)
                    .where(col(UserActressSubscribe.actress_id) == Actress.id)
                    .correlate(Actress)
                    .scalar_subquery()
                ),
                ActressSort.VIEW_CNT: (
                    sa_select(func.count())
                    .select_from(t_video_actress)
                    .join(
                        VideoView,
                        col(VideoView.video_id) == t_video_actress.c.video_id,
                    )
                    .where(t_video_actress.c.fk_id == Actress.id)
                    .correlate(Actress)
                    .scalar_subquery()
                ),
            }

        return cls._aggregate_sort_exprs

    @classmethod
    def _order_clauses(cls, sort: Optional[ActressSort]) -> tuple[Any, ...]:
        """Build ORDER BY clauses: primary sort DESC NULLS LAST, then id.

        Missing measurement/age values sort last. Aggregate sorts use
        correlated subqueries for video / subscription / view totals.
        """

        tie_break = col(Actress.id).asc()

        if sort is None:
            return (tie_break,)

        measurement_columns: dict[ActressSort, Any] = (
            cls._get_measurement_sort_columns()
        )
        primary = measurement_columns.get(sort)

        if primary is not None:
            return (primary.desc().nulls_last(), tie_break)

        if sort == ActressSort.AGE:
            return (cls._age_expr().desc().nulls_last(), tie_break)

        aggregate_expr: dict[ActressSort, Any] = (
            cls._get_aggregate_sort_exprs()
        )
        primary = aggregate_expr.get(sort)

        if primary is not None:
            return (primary.desc(), tie_break)

        return (tie_break,)

    async def list_actresses(
        self,
        *,
        filters: Optional[ActressListFilters] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[Actress]:
        """Return a page of actresses with aka and images loaded.

        Args:
            filters: Optional discovery filters (AND across fields).
            limit: Maximum rows to return.
            offset: Number of rows to skip.

        Returns:
            Matching ``Actress`` instances with relations populated.
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
            .offset(offset)
            .limit(limit)
        )
        statement = self._apply_filters(statement, filters)
        statement = statement.order_by(
            *self._order_clauses(filters.sort if filters else None),
        )
        result = await self.session.exec(statement)

        return list(result.all())

    async def count_actresses(
        self,
        *,
        filters: Optional[ActressListFilters] = None,
    ) -> int:
        """Return the total number of actress rows matching ``filters``."""

        statement = select(func.count()).select_from(Actress)
        statement = self._apply_filters(statement, filters)
        result = await self.session.exec(statement)
        total = result.one()

        return int(total)

    async def count_engagement_for_actresses(
        self,
        actress_ids: list[int],
    ) -> dict[int, dict[str, int]]:
        """Return video / subscription / view totals for many actresses.

        * ``video_cnt`` — rows in ``video_actress`` for the actress
        * ``sub_cnt`` — rows in ``user_actress_subscribe``
        * ``view_cnt`` — ``video_view`` events on videos featuring the actress

        Missing ids default to zeros.

        Args:
            actress_ids: Primary keys to aggregate.

        Returns:
            Mapping of actress id → count dict.
        """

        totals: dict[int, dict[str, int]] = {
            actress_id: {
                "video_cnt": 0,
                "sub_cnt": 0,
                "view_cnt": 0,
            }
            for actress_id in actress_ids
        }

        if not actress_ids:
            return totals

        video_stmt = (
            sa_select(
                t_video_actress.c.fk_id,
                func.count().label("cnt"),
            )
            .where(t_video_actress.c.fk_id.in_(actress_ids))
            .group_by(t_video_actress.c.fk_id)
        )
        video_result = await self.session.execute(video_stmt)

        for actress_id, cnt in video_result.all():
            totals[int(actress_id)]["video_cnt"] = int(cnt)

        sub_stmt = (
            select(
                col(UserActressSubscribe.actress_id),
                func.count().label("cnt"),
            )
            .where(col(UserActressSubscribe.actress_id).in_(actress_ids))
            .group_by(col(UserActressSubscribe.actress_id))
        )
        sub_result = await self.session.exec(sub_stmt)

        for actress_id, cnt in sub_result.all():
            totals[int(actress_id)]["sub_cnt"] = int(cnt)

        view_stmt = (
            sa_select(
                t_video_actress.c.fk_id,
                func.count().label("cnt"),
            )
            .select_from(t_video_actress)
            .join(
                VideoView,
                col(VideoView.video_id) == t_video_actress.c.video_id,
            )
            .where(t_video_actress.c.fk_id.in_(actress_ids))
            .group_by(t_video_actress.c.fk_id)
        )
        view_result = await self.session.execute(view_stmt)

        for actress_id, cnt in view_result.all():
            totals[int(actress_id)]["view_cnt"] = int(cnt)

        return totals
