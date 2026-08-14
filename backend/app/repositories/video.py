"""Video data-access repository."""

from typing import Any, Optional

from sqlalchemy import exists, func
from sqlalchemy import select as sa_select
from sqlalchemy.orm import load_only, selectinload
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
from app.models.director import Director
from app.models.genre import Genre
from app.models.label import Label
from app.models.maker import Maker
from app.models.series import Series
from app.models.video import (
    Video,
    VideoImageUrl,
    VideoSampleImageUrl,
    VideoSampleMovieUrl,
)
from app.models.video_like import VideoLike
from app.repositories.base import BaseRepository
from app.schemas.video_filters import (
    FeaturesCountRange,
    VideoListFilters,
    VideoSort,
)
from app.utils import _col, _relationship_attr


def _catalog_load(relationship: Any, *columns: Any) -> Any:
    """Select-in load a catalog M2M with only public response columns."""

    return selectinload(_relationship_attr(relationship)).load_only(
        *(_col(column) for column in columns),
    )


def _media_load(relationship: Any, *columns: Any) -> Any:
    """Select-in load a media 1:N with only public response columns."""

    return selectinload(_relationship_attr(relationship)).load_only(
        *(_col(column) for column in columns),
    )


def _list_actress_load() -> Any:
    """List endpoints: slim actress rows, no aka/images."""

    return selectinload(_relationship_attr(Video.actresses)).load_only(
        _col(Actress.id),
        _col(Actress.name),
        _col(Actress.ruby),
        _col(Actress.image_url),
    )


def _detail_actress_load() -> Any:
    """Detail endpoints: one actress select-in, then nested aka/images."""

    return selectinload(_relationship_attr(Video.actresses)).options(
        load_only(
            _col(Actress.id),
            _col(Actress.name),
            _col(Actress.ruby),
            _col(Actress.image_url),
            _col(Actress.dmm_id),
        ),
        selectinload(_relationship_attr(Actress.actress_aka)).load_only(
            _col(ActressAka.id),
            _col(ActressAka.name),
            _col(ActressAka.translated_name),
        ),
        selectinload(_relationship_attr(Actress.actress_image)).load_only(
            _col(ActressImage.id),
            _col(ActressImage.url),
            _col(ActressImage.attribute),
        ),
    )


_LIST_OPTIONS: tuple[Any, ...] = (
    _list_actress_load(),
    _catalog_load(
        Video.genres,
        Genre.id,
        Genre.name,
        Genre.ruby,
        Genre.dmm_id,
    ),
    _catalog_load(
        Video.series,
        Series.id,
        Series.name,
        Series.ruby,
        Series.dmm_id,
    ),
    _catalog_load(
        Video.makers,
        Maker.id,
        Maker.name,
        Maker.ruby,
        Maker.dmm_id,
    ),
    _catalog_load(
        Video.labels,
        Label.id,
        Label.name,
        Label.ruby,
        Label.dmm_id,
    ),
    _catalog_load(
        Video.directors,
        Director.id,
        Director.name,
        Director.ruby,
        Director.dmm_id,
    ),
    _media_load(
        Video.video_image_url,
        VideoImageUrl.id,
        VideoImageUrl.url,
        VideoImageUrl.type,
    ),
    _media_load(
        Video.video_sample_image_url,
        VideoSampleImageUrl.id,
        VideoSampleImageUrl.url,
        VideoSampleImageUrl.type,
    ),
    _media_load(
        Video.video_sample_movie_url,
        VideoSampleMovieUrl.id,
        VideoSampleMovieUrl.url,
        VideoSampleMovieUrl.type,
    ),
)

_DETAIL_OPTIONS: tuple[Any, ...] = (
    _detail_actress_load(),
    _catalog_load(
        Video.genres,
        Genre.id,
        Genre.name,
        Genre.ruby,
        Genre.dmm_id,
    ),
    _catalog_load(
        Video.series,
        Series.id,
        Series.name,
        Series.ruby,
        Series.dmm_id,
    ),
    _catalog_load(
        Video.makers,
        Maker.id,
        Maker.name,
        Maker.ruby,
        Maker.dmm_id,
    ),
    _catalog_load(
        Video.labels,
        Label.id,
        Label.name,
        Label.ruby,
        Label.dmm_id,
    ),
    _catalog_load(
        Video.directors,
        Director.id,
        Director.name,
        Director.ruby,
        Director.dmm_id,
    ),
    _media_load(
        Video.video_image_url,
        VideoImageUrl.id,
        VideoImageUrl.url,
        VideoImageUrl.type,
    ),
    _media_load(
        Video.video_sample_image_url,
        VideoSampleImageUrl.id,
        VideoSampleImageUrl.url,
        VideoSampleImageUrl.type,
    ),
    _media_load(
        Video.video_sample_movie_url,
        VideoSampleMovieUrl.id,
        VideoSampleMovieUrl.url,
        VideoSampleMovieUrl.type,
    ),
)


def _exists_link(table: Any, fk_ids: list[int]) -> Any:
    """EXISTS subquery: video linked to any of the given catalog ids."""

    return exists(
        sa_select(1)
        .select_from(table)
        .where(
            table.c.video_id == Video.id,
            table.c.fk_id.in_(fk_ids),
        ),
    )


def _exists_single(table: Any, fk_id: int) -> Any:
    """EXISTS subquery: video linked to one catalog id."""

    return exists(
        sa_select(1)
        .select_from(table)
        .where(
            table.c.video_id == Video.id,
            table.c.fk_id == fk_id,
        ),
    )


def _actress_count_subquery() -> Any:
    """Correlated count of featured actresses for a video."""

    return (
        sa_select(func.count())
        .select_from(t_video_actress)
        .where(t_video_actress.c.video_id == Video.id)
        .correlate(Video)
        .scalar_subquery()
    )


def _like_count_subquery() -> Any:
    """Correlated like count for a video."""

    return (
        sa_select(func.count())
        .select_from(VideoLike)
        .where(col(VideoLike.video_id) == Video.id)
        .correlate(Video)
        .scalar_subquery()
    )


def _apply_filters(statement: Any, filters: VideoListFilters) -> Any:
    """Attach WHERE clauses for discover filters (OR within multi-id lists)."""

    if filters.actress:
        statement = statement.where(
            _exists_link(t_video_actress, filters.actress),
        )

    if filters.genre:
        statement = statement.where(
            _exists_link(t_video_genre, filters.genre),
        )

    if filters.maker is not None:
        statement = statement.where(
            _exists_single(t_video_maker, filters.maker),
        )

    if filters.label is not None:
        statement = statement.where(
            _exists_single(t_video_label, filters.label),
        )

    if filters.director is not None:
        statement = statement.where(
            _exists_single(t_video_director, filters.director),
        )

    if filters.series is not None:
        statement = statement.where(
            _exists_single(t_video_series, filters.series),
        )

    if filters.features_cnt is not None:
        statement = _apply_features_cnt(statement, filters.features_cnt)

    return statement


def _apply_features_cnt(
    statement: Any,
    range_: FeaturesCountRange,
) -> Any:
    """Filter by number of featured actresses."""

    count_expr = _actress_count_subquery()

    if range_.max is None:
        return statement.where(count_expr >= range_.min)

    if range_.min == range_.max:
        return statement.where(count_expr == range_.min)

    return statement.where(
        count_expr >= range_.min,
        count_expr <= range_.max,
    )


def _apply_sort(statement: Any, sort: VideoSort) -> Any:
    """Apply ORDER BY matching frontend discover sort keys.

    ``views`` has no dedicated column yet; it falls back to engagement
    via like count then release date (same secondary keys as trending).
    """

    like_count = _like_count_subquery()
    release = col(Video.release_date).desc().nulls_last()
    video_pk = col(Video.id).desc()

    if sort == VideoSort.LATEST:
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


class VideoRepository(BaseRepository):
    """Read operations for ``Video`` rows."""

    async def list_videos(
        self,
        *,
        filters: Optional[VideoListFilters] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[Video]:
        """Return a page of videos with filters, sort, and relations.

        Args:
            filters: Optional discover filters and sort.
            limit: Maximum rows to return.
            offset: Number of rows to skip.

        Returns:
            Matching ``Video`` instances with list relations populated.
        """

        resolved = filters or VideoListFilters()
        statement = select(Video).options(*_LIST_OPTIONS)
        statement = _apply_filters(statement, resolved)
        statement = _apply_sort(statement, resolved.sort)
        statement = statement.offset(offset).limit(limit)
        result = await self.session.exec(statement)

        return list(result.all())

    async def count_videos(
        self,
        *,
        filters: Optional[VideoListFilters] = None,
    ) -> int:
        """Return the number of videos matching optional filters."""

        resolved = filters or VideoListFilters()
        statement = select(func.count()).select_from(Video)
        statement = _apply_filters(statement, resolved)
        result = await self.session.exec(statement)
        total = result.one()

        return int(total)

    async def get_by_id(self, video_id: int) -> Optional[Video]:
        """Return one video by primary key with full relation graph.

        Args:
            video_id: ``Video.id`` primary key (not the string code).

        Returns:
            The ``Video`` row or ``None`` when missing.
        """

        statement = (
            select(Video)
            .where(col(Video.id) == video_id)
            .options(*_DETAIL_OPTIONS)
        )
        result = await self.session.exec(statement)

        return result.first()
