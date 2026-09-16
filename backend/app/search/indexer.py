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
from app.models.video import Video
from app.search.mappings import VIDEOS_INDEX_MAPPINGS, VIDEOS_INDEX_SETTINGS
from app.utils.query import relationship_attr


def video_to_document(video: Video) -> dict[str, Any]:
    """Serialize a loaded ``Video`` row into an Elasticsearch document."""

    actresses = list(getattr(video, "actresses", None) or [])
    genres = list(getattr(video, "genres", None) or [])
    series = list(getattr(video, "series", None) or [])
    makers = list(getattr(video, "makers", None) or [])
    labels = list(getattr(video, "labels", None) or [])
    directors = list(getattr(video, "directors", None) or [])
    akas = list(getattr(video, "video_aka", None) or [])

    return {
        "id": video.id,
        "video_id": video.video_id,
        "title": video.title or "",
        "title_akas": [
            aka.translated_name
            for aka in akas
            if getattr(aka, "translated_name", None)
        ],
        "release_date": (
            video.release_date.isoformat()
            if video.release_date is not None
            else None
        ),
        "actress_ids": [actress.id for actress in actresses],
        "actress_names": [
            actress.name for actress in actresses if actress.name
        ],
        "genre_ids": [genre.id for genre in genres],
        "genre_names": [genre.name for genre in genres if genre.name],
        "series_ids": [item.id for item in series],
        "series_names": [item.name for item in series if item.name],
        "maker_ids": [item.id for item in makers],
        "maker_names": [item.name for item in makers if item.name],
        "label_ids": [item.id for item in labels],
        "label_names": [item.name for item in labels if item.name],
        "director_ids": [item.id for item in directors],
        "director_names": [item.name for item in directors if item.name],
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
                    selectinload(relationship_attr(Video.actresses)),
                    selectinload(relationship_attr(Video.genres)),
                    selectinload(relationship_attr(Video.series)),
                    selectinload(relationship_attr(Video.makers)),
                    selectinload(relationship_attr(Video.labels)),
                    selectinload(relationship_attr(Video.directors)),
                    selectinload(relationship_attr(Video.video_aka)),
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
