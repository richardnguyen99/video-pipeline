"""Build and bulk-index actress documents into Elasticsearch."""

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
from app.search.mappings import (
    ACTRESSES_INDEX_MAPPINGS,
    ACTRESSES_INDEX_SETTINGS,
)
from app.utils.query import relationship_attr


def actress_to_document(actress: Actress) -> dict[str, Any]:
    """Serialize a loaded ``Actress`` row into an Elasticsearch document."""

    aka = getattr(actress, "actress_aka", None)
    aka_names: list[str] = []
    aka_translated: list[str] = []

    if aka is not None:
        name = getattr(aka, "name", None)

        if name:
            aka_names.append(str(name))

        translated = getattr(aka, "translated_name", None)

        if translated:
            aka_translated.append(str(translated))

    return {
        "id": actress.id,
        "name": actress.name or "",
        "original_name": actress.original_name or "",
        "dmm_name": actress.dmm_name or "",
        "dmm_id": actress.dmm_id or "",
        "ruby": actress.ruby or "",
        "aka_names": aka_names,
        "aka_translated_names": aka_translated,
    }


class ActressIndexer:
    """Ensure the actresses index exists and push documents from Postgres."""

    def __init__(
        self,
        client: AsyncElasticsearch,
        session: AsyncSession,
        *,
        index_name: Optional[str] = None,
    ) -> None:
        self._client = client
        self._session = session
        self._index = index_name or settings.elasticsearch_index_actresses

    async def ensure_index(self, *, recreate: bool = False) -> None:
        """Create the actresses index (optionally drop first)."""

        index_exists = bool(
            await self._client.indices.exists(index=self._index),
        )

        if index_exists and recreate:
            await self._client.indices.delete(index=self._index)
            index_exists = False

        if not index_exists:
            await self._client.indices.create(
                index=self._index,
                settings=ACTRESSES_INDEX_SETTINGS,
                mappings=ACTRESSES_INDEX_MAPPINGS,
            )

    async def iter_actresses(
        self,
        *,
        batch_size: int = 200,
        actress_ids: Optional[Sequence[int]] = None,
    ) -> AsyncIterator[list[Actress]]:
        """Yield batches of actresses with aka loaded."""

        offset = 0

        while True:
            statement = (
                select(Actress)
                .options(
                    selectinload(relationship_attr(Actress.actress_aka)),
                )
                .order_by(col(Actress.id).asc())
                .offset(offset)
                .limit(batch_size)
            )

            if actress_ids is not None:
                statement = statement.where(
                    col(Actress.id).in_(list(actress_ids)),
                )

            rows = list((await self._session.exec(statement)).all())

            if not rows:
                break

            yield rows
            offset += batch_size

            if actress_ids is not None:
                break

    async def index_actresses(
        self,
        actresses: Sequence[Actress],
    ) -> int:
        """Bulk-index the given actress rows. Returns document count."""

        if not actresses:
            return 0

        actions = [
            {
                "_index": self._index,
                "_id": str(actress.id),
                "_source": actress_to_document(actress),
            }
            for actress in actresses
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
        """Ensure index, stream all actresses from Postgres, bulk index."""

        await self.ensure_index(recreate=recreate)
        total = 0

        async for batch in self.iter_actresses(batch_size=batch_size):
            total += await self.index_actresses(batch)

        await self._client.indices.refresh(index=self._index)

        return total
