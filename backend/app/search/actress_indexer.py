"""Build and bulk-index actress documents into Elasticsearch."""

from __future__ import annotations

from collections.abc import AsyncIterator, Sequence
from typing import Any, Optional

from elasticsearch import AsyncElasticsearch
from elasticsearch.helpers import async_bulk
from sqlalchemy import func
from sqlalchemy import select as sa_select
from sqlalchemy.orm import selectinload
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import settings
from app.models.actress import Actress
from app.models.associations import t_video_actress
from app.search.mappings import (
    ACTRESSES_INDEX_MAPPINGS,
    ACTRESSES_INDEX_SETTINGS,
)
from app.utils.query import relationship_attr


def _has_profile_details(actress: Actress) -> bool:
    """True when the profile has measurable or biographic fields filled."""

    return any(
        (
            actress.birthday,
            actress.bust is not None,
            actress.waist is not None,
            actress.hip is not None,
            actress.height is not None,
            (actress.cup or "").strip(),
            (actress.hobby or "").strip(),
            (actress.prefectures or "").strip(),
        ),
    )


def _has_actress_image(actress: Actress) -> bool:
    """True when a primary image URL or related image rows exist."""

    if (actress.image_url or "").strip():
        return True

    images = list(getattr(actress, "actress_image", None) or [])

    for image in images:
        url = getattr(image, "url", None)

        if url and str(url).strip():
            return True

    return False


def _pick_image_url(actress: Actress) -> str:
    """Prefer the denormalized image URL, then the first related image."""

    primary = (actress.image_url or "").strip()

    if primary:
        return primary

    images = list(getattr(actress, "actress_image", None) or [])

    for image in images:
        url = getattr(image, "url", None)

        if url and str(url).strip():
            return str(url).strip()

    return ""


def actress_to_document(
    actress: Actress,
    *,
    video_cnt: int = 0,
) -> dict[str, Any]:
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
        "video_cnt": max(0, int(video_cnt)),
        "has_image": _has_actress_image(actress),
        "has_details": _has_profile_details(actress),
        "image_url": _pick_image_url(actress),
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

    async def _video_counts(
        self,
        actress_ids: Sequence[int],
    ) -> dict[int, int]:
        """Return video link counts keyed by actress id."""

        if not actress_ids:
            return {}

        statement = (
            sa_select(
                t_video_actress.c.fk_id,
                func.count().label("cnt"),
            )
            .where(t_video_actress.c.fk_id.in_(list(actress_ids)))
            .group_by(t_video_actress.c.fk_id)
        )
        result = await self._session.execute(statement)

        return {int(actress_id): int(cnt) for actress_id, cnt in result.all()}

    async def iter_actresses(
        self,
        *,
        batch_size: int = 200,
        actress_ids: Optional[Sequence[int]] = None,
    ) -> AsyncIterator[list[Actress]]:
        """Yield batches of actresses with aka and images loaded."""

        offset = 0

        while True:
            statement = (
                select(Actress)
                .options(
                    selectinload(relationship_attr(Actress.actress_aka)),
                    selectinload(relationship_attr(Actress.actress_image)),
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

        counts = await self._video_counts(
            [actress.id for actress in actresses if actress.id is not None],
        )
        actions = [
            {
                "_index": self._index,
                "_id": str(actress.id),
                "_source": actress_to_document(
                    actress,
                    video_cnt=counts.get(int(actress.id), 0),
                ),
            }
            for actress in actresses
            if actress.id is not None
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
