"""Video list/detail query helpers for the video repository."""

from typing import Optional, TypeVar, cast

from sqlalchemy import exists, func, literal, or_
from sqlalchemy import select as sa_select
from sqlalchemy.orm.interfaces import LoaderOption
from sqlalchemy.sql import ColumnElement
from sqlalchemy.sql.selectable import ScalarSelect
from sqlmodel import col
from sqlmodel.sql.expression import SelectOfScalar

from app.models.associations import (
    t_video_actress,
    t_video_director,
    t_video_genre,
    t_video_label,
    t_video_maker,
    t_video_series,
)
from app.models.director import Director, DirectorAka
from app.models.genre import Genre, GenreAka
from app.models.label import Label, LabelAka
from app.models.maker import Maker, MakerAka
from app.models.series import Series, SeriesAka
from app.models.video import (
    Video,
    VideoAka,
    VideoImageUrl,
    VideoSampleImageUrl,
    VideoSampleMovieUrl,
)
from app.models.video_reaction import VideoReaction
from app.schemas.video_filters import VideoListFilters, VideoSort
from app.utils.actress import apply_features_cnt, detail_actress_load
from app.utils.common import (
    catalog_ids_predicate,
    catalog_load_with_aka,
    exists_link,
    exists_single,
    media_load,
    search_terms,
)

RowT = TypeVar("RowT")


def like_count_subquery() -> ScalarSelect[int]:
    """Correlated like count for a video (``is_like is True``)."""

    return (
        sa_select(func.count())
        .select_from(VideoReaction)
        .where(
            col(VideoReaction.video_id) == Video.id,
            col(VideoReaction.is_like).is_(True),
        )
        .correlate(Video)
        .scalar_subquery()
    )


def term_video_predicate(term: str) -> ColumnElement[bool]:
    """Match one term on video_id, title, or video aka (index-friendly)."""

    pattern = f"%{term}%"

    aka_match = exists(
        sa_select(1)
        .select_from(VideoAka)
        .where(
            col(VideoAka.fk_id) == col(Video.id),
            col(VideoAka.translated_name).ilike(pattern),
        ),
    )

    return or_(
        col(Video.video_id).ilike(pattern),
        col(Video.title).ilike(pattern),
        aka_match,
    )


def apply_search_with_catalog_ids(
    statement: SelectOfScalar[RowT],
    filters: VideoListFilters,
    catalog_by_term: list[dict[str, list[int]]],
) -> SelectOfScalar[RowT]:
    """AND each term: video fields OR pre-resolved catalog id links.

    Catalog ids are resolved in one batch query per entity type so the
    main list query avoids nested correlated EXISTS on name/aka tables.
    """

    if filters.q is None or not filters.q.strip():
        return statement

    terms = search_terms(filters.q)

    for term, catalog_ids in zip(terms, catalog_by_term, strict=True):
        predicates: list[ColumnElement[bool]] = [term_video_predicate(term)]

        for link_table, key in (
            (t_video_actress, "actress"),
            (t_video_genre, "genre"),
            (t_video_maker, "maker"),
            (t_video_label, "label"),
            (t_video_series, "series"),
            (t_video_director, "director"),
        ):
            pred = catalog_ids_predicate(link_table, catalog_ids.get(key, []))

            if pred is not None:
                predicates.append(pred)

        statement = statement.where(or_(*predicates))

    return statement


def term_video_relevance(term: str) -> ColumnElement[float]:
    """Trigram similarity on video fields only (cheap rank key)."""

    lowered = term.lower()

    return cast(
        ColumnElement[float],
        func.greatest(
            func.similarity(func.lower(col(Video.video_id)), lowered),
            func.similarity(
                func.lower(func.coalesce(col(Video.title), "")),
                lowered,
            ),
        ),
    )


def video_relevance_expr(raw_query: str) -> ColumnElement[float]:
    """Sum per-term video-field relevance for multi-term ``q``."""

    terms = search_terms(raw_query)

    if not terms:
        return cast(ColumnElement[float], literal(0.0))

    score = term_video_relevance(terms[0])

    for term in terms[1:]:
        score = score + term_video_relevance(term)

    return score


def apply_filters(
    statement: SelectOfScalar[RowT],
    filters: VideoListFilters,
) -> SelectOfScalar[RowT]:
    """Attach WHERE clauses for discover filters (OR within multi-id lists)."""

    if filters.actress:
        statement = statement.where(
            exists_link(t_video_actress, filters.actress),
        )

    if filters.genre:
        statement = statement.where(
            exists_link(t_video_genre, filters.genre),
        )

    if filters.maker is not None:
        statement = statement.where(
            exists_single(t_video_maker, filters.maker),
        )

    if filters.label is not None:
        statement = statement.where(
            exists_single(t_video_label, filters.label),
        )

    if filters.director is not None:
        statement = statement.where(
            exists_single(t_video_director, filters.director),
        )

    if filters.series is not None:
        statement = statement.where(
            exists_single(t_video_series, filters.series),
        )

    if filters.features_cnt is not None:
        statement = apply_features_cnt(statement, filters.features_cnt)

    return statement


def apply_sort(
    statement: SelectOfScalar[RowT],
    sort: VideoSort,
    filters: Optional[VideoListFilters] = None,
) -> SelectOfScalar[RowT]:
    """Apply ORDER BY matching frontend discover sort keys.

    ``views`` has no dedicated column yet; it falls back to engagement
    via like count then release date (same secondary keys as trending).
    """

    like_count = like_count_subquery()
    release = col(Video.release_date).desc().nulls_last()
    video_pk = col(Video.id).desc()

    if sort == VideoSort.LATEST:
        return statement.order_by(release, video_pk)

    if sort == VideoSort.ID:
        return statement.order_by(col(Video.id).asc())

    if sort == VideoSort.RANK:
        if filters is not None and filters.q and filters.q.strip():
            score = video_relevance_expr(filters.q)

            return statement.order_by(score.desc(), col(Video.id).asc())

        return statement.order_by(release, video_pk)

    if sort in {
        VideoSort.LIKES,
        VideoSort.VIEWS,
        VideoSort.TRENDING_WEEK,
        VideoSort.TRENDING_MONTH,
        VideoSort.TRENDING_ALL,
    }:
        return statement.order_by(like_count.desc(), release, video_pk)

    return statement.order_by(release, video_pk)


DETAIL_OPTIONS: tuple[LoaderOption, ...] = (
    media_load(
        Video.video_aka,
        VideoAka.id,
        VideoAka.translated_name,
        VideoAka.language,
    ),
    detail_actress_load(),
    catalog_load_with_aka(
        Video.genres,
        Genre.genre_aka,
        GenreAka,
        Genre.id,
        Genre.name,
        Genre.ruby,
        Genre.dmm_id,
    ),
    catalog_load_with_aka(
        Video.series,
        Series.series_aka,
        SeriesAka,
        Series.id,
        Series.name,
        Series.ruby,
        Series.dmm_id,
    ),
    catalog_load_with_aka(
        Video.makers,
        Maker.maker_aka,
        MakerAka,
        Maker.id,
        Maker.name,
        Maker.ruby,
        Maker.dmm_id,
    ),
    catalog_load_with_aka(
        Video.labels,
        Label.label_aka,
        LabelAka,
        Label.id,
        Label.name,
        Label.ruby,
        Label.dmm_id,
    ),
    catalog_load_with_aka(
        Video.directors,
        Director.director_aka,
        DirectorAka,
        Director.id,
        Director.name,
        Director.ruby,
        Director.dmm_id,
    ),
    media_load(
        Video.video_image_url,
        VideoImageUrl.id,
        VideoImageUrl.url,
        VideoImageUrl.type,
    ),
    media_load(
        Video.video_sample_image_url,
        VideoSampleImageUrl.id,
        VideoSampleImageUrl.url,
        VideoSampleImageUrl.type,
    ),
    media_load(
        Video.video_sample_movie_url,
        VideoSampleMovieUrl.id,
        VideoSampleMovieUrl.url,
        VideoSampleMovieUrl.type,
    ),
)
