"""Actress-related query helpers for video repositories."""

from typing import TypeVar

from sqlalchemy import func
from sqlalchemy import select as sa_select
from sqlalchemy.orm import load_only, selectinload
from sqlalchemy.orm.interfaces import LoaderOption
from sqlalchemy.sql import ColumnElement
from sqlalchemy.sql.selectable import ScalarSelect
from sqlmodel.sql.expression import SelectOfScalar

from app.models.actress import Actress, ActressAka, ActressImage
from app.models.associations import t_video_actress
from app.models.video import Video
from app.schemas.video_filters import FeaturesCountRange
from app.utils.query import query_col, relationship_attr

RowT = TypeVar("RowT")


def detail_actress_load() -> LoaderOption:
    """Detail endpoints: one actress select-in, then nested aka/images."""

    return selectinload(relationship_attr(Video.actresses)).options(
        load_only(
            query_col(Actress.id),
            query_col(Actress.name),
            query_col(Actress.ruby),
            query_col(Actress.image_url),
            query_col(Actress.dmm_id),
        ),
        selectinload(relationship_attr(Actress.actress_aka)).load_only(
            query_col(ActressAka.id),
            query_col(ActressAka.name),
            query_col(ActressAka.translated_name),
        ),
        selectinload(relationship_attr(Actress.actress_image)).load_only(
            query_col(ActressImage.id),
            query_col(ActressImage.url),
            query_col(ActressImage.attribute),
        ),
    )


def actress_count_subquery() -> ScalarSelect[int]:
    """Correlated count of featured actresses for a video."""

    return (
        sa_select(func.count())
        .select_from(t_video_actress)
        .where(t_video_actress.c.video_id == Video.id)
        .correlate(Video)
        .scalar_subquery()
    )


def apply_features_cnt(
    statement: SelectOfScalar[RowT],
    range_: FeaturesCountRange,
) -> SelectOfScalar[RowT]:
    """Filter by number of featured actresses."""

    count_expr: ColumnElement[int] = actress_count_subquery()

    if range_.max is None:
        return statement.where(count_expr >= range_.min)

    if range_.min == range_.max:
        return statement.where(count_expr == range_.min)

    return statement.where(
        count_expr >= range_.min,
        count_expr <= range_.max,
    )
