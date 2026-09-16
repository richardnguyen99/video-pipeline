"""Query the videos Elasticsearch index."""

from __future__ import annotations

from typing import Any, Optional

from elasticsearch import AsyncElasticsearch

from app.config import settings
from app.schemas.video_filters import VideoListFilters, VideoSort


class VideoSearchService:
    """Run filtered full-text search against the videos index."""

    def __init__(
        self,
        client: AsyncElasticsearch,
        *,
        index_name: Optional[str] = None,
    ) -> None:
        self._client = client
        self._index = index_name or settings.elasticsearch_index_videos

    def _filter_clauses(
        self,
        filters: VideoListFilters,
    ) -> list[dict[str, Any]]:
        """Build Elasticsearch filter clauses from discover filters."""

        clauses: list[dict[str, Any]] = []

        if filters.actress:
            clauses.append({"terms": {"actress_ids": list(filters.actress)}})

        if filters.genre:
            clauses.append({"terms": {"genre_ids": list(filters.genre)}})

        if filters.series is not None:
            clauses.append({"term": {"series_ids": filters.series}})

        if filters.maker is not None:
            clauses.append({"term": {"maker_ids": filters.maker}})

        if filters.label is not None:
            clauses.append({"term": {"label_ids": filters.label}})

        if filters.director is not None:
            clauses.append({"term": {"director_ids": filters.director}})

        return clauses

    def _sort_clause(self, sort: VideoSort) -> list[str | dict[str, Any]]:
        """Map app sort values to Elasticsearch sort."""

        if sort == VideoSort.LATEST:
            return [
                {"release_date": {"order": "desc", "missing": "_last"}},
                {"id": {"order": "desc"}},
            ]

        if sort == VideoSort.ID:
            return [{"id": {"order": "asc"}}]

        return [
            "_score",
            {"release_date": {"order": "desc", "missing": "_last"}},
            {"id": {"order": "desc"}},
        ]

    async def search_video_ids(
        self,
        *,
        filters: VideoListFilters,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[int], int]:
        """Return ordered video primary keys and total hits for a query.

        When ``filters.q`` is empty, only filter/sort clauses apply (browse mode).
        """

        must: list[dict[str, Any]] = []
        query_text = (filters.q or "").strip()

        if query_text:
            must.append(
                {
                    "multi_match": {
                        "query": query_text,
                        "fields": [
                            "video_id^5",
                            "video_id.text^4",
                            "title^3",
                            "title_akas^2",
                            "actress_names^2",
                            "genre_names",
                            "series_names",
                            "maker_names",
                            "label_names",
                            "director_names",
                        ],
                        "type": "best_fields",
                        "operator": "and",
                        "fuzziness": "AUTO",
                    },
                },
            )

        filter_clauses = self._filter_clauses(filters)
        bool_query: dict[str, Any] = {}

        if must:
            bool_query["must"] = must
        else:
            bool_query["must"] = [{"match_all": {}}]

        if filter_clauses:
            bool_query["filter"] = filter_clauses

        response = await self._client.search(
            index=self._index,
            query={"bool": bool_query},
            from_=max(0, offset),
            size=max(1, min(limit, 100)),
            sort=self._sort_clause(filters.sort),
            source=False,
        )
        hits = response.get("hits", {})
        total_raw = hits.get("total", 0)
        total = (
            int(total_raw.get("value", 0))
            if isinstance(total_raw, dict)
            else int(total_raw or 0)
        )
        ids = [int(hit["_id"]) for hit in hits.get("hits", [])]

        return ids, total
