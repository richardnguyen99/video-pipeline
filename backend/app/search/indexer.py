"""Build and bulk-index video documents into Elasticsearch."""

from __future__ import annotations

from collections.abc import AsyncIterator, Sequence
from typing import Any, Optional

from elasticsearch import AsyncElasticsearch
from elasticsearch.helpers import async_bulk
from sqlalchemy.orm import selectinload
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import settings
from app.models.actress import Actress
from app.models.director import Director
from app.models.genre import Genre
from app.models.label import Label
from app.models.maker import Maker
from app.models.series import Series
from app.models.video import Video
from app.search.mappings import VIDEOS_INDEX_MAPPINGS, VIDEOS_INDEX_SETTINGS
from app.utils.query import relationship_attr


def _unique_strings(*values: object) -> list[str]:
    """Return non-empty string values in order, de-duplicated."""

    seen: set[str] = set()
    result: list[str] = []

    for value in values:
        if value is None:
            continue

        text = str(value).strip()

        if not text or text in seen:
            continue

        seen.add(text)
        result.append(text)

    return result


def _actress_search_names(actress: object) -> list[str]:
    """Collect searchable name variants for one actress."""

    names = _unique_strings(
        getattr(actress, "name", None),
        getattr(actress, "original_name", None),
        getattr(actress, "dmm_name", None),
        getattr(actress, "ruby", None),
    )
    aka = getattr(actress, "actress_aka", None)

    if aka is not None:
        names = _unique_strings(
            *names,
            getattr(aka, "name", None),
            getattr(aka, "translated_name", None),
        )

    return names


def _catalog_search_names(
    entity: object,
    aka_attr: str,
) -> list[str]:
    """Collect name + ruby + aka translated names for a catalog entity."""

    names = _unique_strings(
        getattr(entity, "name", None),
        getattr(entity, "ruby", None),
    )
    akas = list(getattr(entity, aka_attr, None) or [])

    for aka in akas:
        names = _unique_strings(
            *names,
            getattr(aka, "translated_name", None),
        )

    return names


def _pick_video_image_url(video: object) -> Optional[str]:
    """Prefer list / small / large cover URL for search UI thumbnails."""

    images = list(getattr(video, "video_image_url", None) or [])
    priority = ("list", "small", "large")

    by_type: dict[str, str] = {}

    for image in images:
        url = getattr(image, "url", None)
        image_type = (getattr(image, "type", None) or "").strip().lower()

        if not url:
            continue

        text_url = str(url).strip()

        if not text_url:
            continue

        if image_type and image_type not in by_type:
            by_type[image_type] = text_url

    for preferred in priority:
        if preferred in by_type:
            return by_type[preferred]

    for image in images:
        url = getattr(image, "url", None)

        if url and str(url).strip():
            return str(url).strip()

    return None


def video_to_document(video: Video) -> dict[str, Any]:
    """Serialize a loaded ``Video`` row into an Elasticsearch document."""

    actresses = list(getattr(video, "actresses", None) or [])
    genres = list(getattr(video, "genres", None) or [])
    series = list(getattr(video, "series", None) or [])
    makers = list(getattr(video, "makers", None) or [])
    labels = list(getattr(video, "labels", None) or [])
    directors = list(getattr(video, "directors", None) or [])
    akas = list(getattr(video, "video_aka", None) or [])

    actress_names: list[str] = []

    for actress in actresses:
        actress_names.extend(_actress_search_names(actress))

    actress_names = _unique_strings(*actress_names)
    genre_names = _unique_strings(
        *[
            name
            for genre in genres
            for name in _catalog_search_names(genre, "genre_aka")
        ],
    )
    series_names = _unique_strings(
        *[
            name
            for item in series
            for name in _catalog_search_names(item, "series_aka")
        ],
    )
    maker_names = _unique_strings(
        *[
            name
            for item in makers
            for name in _catalog_search_names(item, "maker_aka")
        ],
    )
    label_names = _unique_strings(
        *[
            name
            for item in labels
            for name in _catalog_search_names(item, "label_aka")
        ],
    )
    director_names = _unique_strings(
        *[
            name
            for item in directors
            for name in _catalog_search_names(item, "director_aka")
        ],
    )
    title_akas = [
        str(aka.translated_name)
        for aka in akas
        if getattr(aka, "translated_name", None)
    ]
    search_blob = " ".join(
        _unique_strings(
            video.video_id,
            video.title,
            *title_akas,
            *actress_names,
            *genre_names,
            *series_names,
            *maker_names,
            *label_names,
            *director_names,
        ),
    )

    return {
        "id": video.id,
        "video_id": video.video_id,
        "title": video.title or "",
        "title_akas": title_akas,
        "release_date": (
            video.release_date.isoformat()
            if video.release_date is not None
            else None
        ),
        "actress_ids": [actress.id for actress in actresses],
        "actress_names": actress_names,
        "genre_ids": [genre.id for genre in genres],
        "genre_names": genre_names,
        "series_ids": [item.id for item in series],
        "series_names": series_names,
        "maker_ids": [item.id for item in makers],
        "maker_names": maker_names,
        "label_ids": [item.id for item in labels],
        "label_names": label_names,
        "director_ids": [item.id for item in directors],
        "director_names": director_names,
        "search_blob": search_blob,
        "image_url": _pick_video_image_url(video),
    }


class VideoIndexer:
    """Ensure the videos index exists and push documents from Postgres."""

    def __init__(
        self,
        client: AsyncElasticsearch,
        session: AsyncSession,
        *,
        index_name: Optional[str] = None,
    ) -> None:
        self._client = client
        self._session = session
        self._index = index_name or settings.elasticsearch_index_videos

    async def ensure_index(self, *, recreate: bool = False) -> None:
        """Create the videos index (optionally drop first)."""

        index_exists = bool(
            await self._client.indices.exists(index=self._index),
        )

        if index_exists and recreate:
            await self._client.indices.delete(index=self._index)
            index_exists = False

        if not index_exists:
            await self._client.indices.create(
                index=self._index,
                settings=VIDEOS_INDEX_SETTINGS,
                mappings=VIDEOS_INDEX_MAPPINGS,
            )

    async def iter_videos(
        self,
        *,
        batch_size: int = 200,
        video_ids: Optional[Sequence[int]] = None,
    ) -> AsyncIterator[list[Video]]:
        """Yield batches of videos with catalog relations loaded."""

        offset = 0

        while True:
            statement = (
                select(Video)
                .options(
                    selectinload(
                        relationship_attr(Video.actresses)
                    ).selectinload(
                        relationship_attr(Actress.actress_aka),
                    ),
                    selectinload(relationship_attr(Video.genres)).selectinload(
                        relationship_attr(Genre.genre_aka),
                    ),
                    selectinload(relationship_attr(Video.series)).selectinload(
                        relationship_attr(Series.series_aka),
                    ),
                    selectinload(relationship_attr(Video.makers)).selectinload(
                        relationship_attr(Maker.maker_aka),
                    ),
                    selectinload(relationship_attr(Video.labels)).selectinload(
                        relationship_attr(Label.label_aka),
                    ),
                    selectinload(
                        relationship_attr(Video.directors)
                    ).selectinload(
                        relationship_attr(Director.director_aka),
                    ),
                    selectinload(relationship_attr(Video.video_aka)),
                    selectinload(relationship_attr(Video.video_image_url)),
                )
                .order_by(col(Video.id).asc())
                .offset(offset)
                .limit(batch_size)
            )

            if video_ids is not None:
                statement = statement.where(col(Video.id).in_(list(video_ids)))

            rows = list((await self._session.exec(statement)).all())

            if not rows:
                break

            yield rows
            offset += batch_size

            if video_ids is not None:
                break

    async def index_videos(
        self,
        videos: Sequence[Video],
    ) -> int:
        """Bulk-index the given video rows. Returns document count."""

        if not videos:
            return 0

        actions = [
            {
                "_index": self._index,
                "_id": str(video.id),
                "_source": video_to_document(video),
            }
            for video in videos
        ]
        success, _errors = await async_bulk(
            self._client,
            actions,
            raise_on_error=False,
            refresh=False,
        )

        return int(success)

    async def reindex_all(
        self,
        *,
        batch_size: int = 200,
        recreate: bool = False,
    ) -> int:
        """Ensure index, stream all videos from Postgres, bulk index."""

        await self.ensure_index(recreate=recreate)
        total = 0

        async for batch in self.iter_videos(batch_size=batch_size):
            total += await self.index_videos(batch)

        await self._client.indices.refresh(index=self._index)

        return total
