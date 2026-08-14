"""Video data-access repository."""

from typing import Any, Optional

from sqlalchemy.orm import load_only, selectinload
from sqlmodel import col, func, select

from app.models.actress import Actress, ActressAka, ActressImage
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
from app.repositories.base import BaseRepository
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
    """Detail endpoints: one actress select-in, then nested aka/images.

    Using a single parent ``selectinload(Video.actresses)`` avoids issuing
    the actress IN-query twice when nesting aka and image collections.
    """

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


class VideoRepository(BaseRepository):
    """Read operations for ``Video`` rows."""

    async def list_videos(
        self,
        *,
        limit: int = 20,
        offset: int = 0,
    ) -> list[Video]:
        """Return a page of videos with related entities loaded.

        Uses ``selectinload`` (not joined loads) so multiple collections do
        not multiply rows. Related rows only fetch columns needed by the
        list schema. Actress aka/images are omitted on list queries.

        Args:
            limit: Maximum rows to return.
            offset: Number of rows to skip.

        Returns:
            Matching ``Video`` instances with relations populated.
        """

        statement = (
            select(Video)
            .options(*_LIST_OPTIONS)
            .order_by(col(Video.id))
            .offset(offset)
            .limit(limit)
        )
        result = await self.session.exec(statement)

        return list(result.all())

    async def get_by_id(self, video_id: int) -> Optional[Video]:
        """Return one video by primary key with full relation graph.

        Actress collections are loaded once, then aka/images in separate
        select-in queries (no duplicated parent actress query).

        Args:
            video_id: ``Video.id`` primary key (not the string ``video_id`` code).

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

    async def count_videos(self) -> int:
        """Return the total number of video rows."""

        statement = select(func.count()).select_from(Video)
        result = await self.session.exec(statement)
        total = result.one()

        return int(total)
