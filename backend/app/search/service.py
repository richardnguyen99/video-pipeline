"""Query the videos Elasticsearch index."""

from __future__ import annotations

from typing import Any, Optional

from elasticsearch import AsyncElasticsearch

from app.config import settings
from app.schemas.video_filters import VideoListFilters, VideoSort
from app.utils.common import search_terms

_MATCH_FIELDS: list[str] = [
    "video_id.text^5",
    "title^3",
    "title_akas^2",
    "actress_names^4",
    "genre_names^2",
    "series_names",
    "maker_names",
    "label_names",
    "director_names",
    "search_blob",
]

_SUBSTRING_FIELDS: list[str] = [
    "video_id",
    "title.keyword",
    "title_akas.keyword",
    "actress_names.keyword",
    "genre_names.keyword",
    "series_names.keyword",
    "maker_names.keyword",
    "label_names.keyword",
    "director_names.keyword",
    "search_blob.keyword",
]


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
        self, filters: VideoListFilters
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

    def _substring_should(self, term: str) -> list[dict[str, Any]]:
        """Postgres ``ILIKE %term%`` parity via case-insensitive wildcards.

        Only used for terms long enough to avoid matching noise.
        """

        if len(term) < 2:
            return []

        pattern = f"*{term.lower()}*"

        return [
            {
                "wildcard": {
                    field: {
                        "value": pattern,
                        "case_insensitive": True,
                    },
                },
            }
            for field in _SUBSTRING_FIELDS
        ]

    def _term_clause(self, term: str) -> dict[str, Any]:
        """Match one term on video fields OR catalog names (Postgres parity).

        - Analyzed ``multi_match`` (no fuzziness) for token equality
        - Keyword wildcards for substring contains (``ILIKE %term%``)
        - ``match_phrase`` boosts contiguous multi-character / multi-word names
        """

        should: list[dict[str, Any]] = [
            {
                "multi_match": {
                    "query": term,
                    "fields": _MATCH_FIELDS,
                    "type": "best_fields",
                    "operator": "and",
                },
            },
            {
                "match_phrase": {
                    "actress_names": {
                        "query": term,
                        "boost": 6,
                    },
                },
            },
            {
                "match_phrase": {
                    "title": {
                        "query": term,
                        "boost": 3,
                    },
                },
            },
            {
                "match_phrase": {
                    "genre_names": {
                        "query": term,
                        "boost": 2,
                    },
                },
            },
            *self._substring_should(term),
        ]

        return {
            "bool": {
                "should": should,
                "minimum_should_match": 1,
            },
        }

    def _text_must_clauses(self, query_text: str) -> list[dict[str, Any]]:
        """AND across terms; each term may match any catalog/title field.

        Mirrors Postgres discover search: terms are split on ``+`` / whitespace,
        every term must hit somewhere (code, title, aka, actress, genre, …).
        """

        terms = search_terms(query_text)

        if not terms:
            return []

        return [self._term_clause(term) for term in terms]

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

        query_text = (filters.q or "").strip()
        must: list[dict[str, Any]] = (
            self._text_must_clauses(query_text)
            if query_text
            else [{"match_all": {}}]
        )
        filter_clauses = self._filter_clauses(filters)
        bool_query: dict[str, Any] = {"must": must}

        if filter_clauses:
            bool_query["filter"] = filter_clauses

        response = await self._client.search(
            index=self._index,
            query={"bool": bool_query},
            from_=max(0, offset),
            size=max(1, min(limit, 100)),
            sort=self._sort_clause(filters.sort),
            source=False,
            track_total_hits=True,
            request_cache=True,
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

    async def search_documents(
        self,
        *,
        query_text: str,
        limit: int = 20,
        offset: int = 0,
        source_fields: Optional[list[str]] = None,
    ) -> tuple[list[dict[str, Any]], int]:
        """Return video documents and total hits for Search UI proxy."""

        text = (query_text or "").strip()
        must: list[dict[str, Any]] = (
            self._text_must_clauses(text) if text else [{"match_all": {}}]
        )
        fields = source_fields or [
            "id",
            "video_id",
            "title",
            "title_akas",
            "release_date",
            "actress_names",
            "genre_names",
            "series_names",
            "maker_names",
            "label_names",
            "director_names",
            "image_url",
        ]

        response = await self._client.search(
            index=self._index,
            query={"bool": {"must": must}},
            from_=max(0, offset),
            size=max(1, min(limit, 100)),
            sort=["_score", {"id": {"order": "desc"}}],
            source={"includes": fields},
            track_total_hits=True,
            request_cache=True,
        )
        hits = response.get("hits", {})
        total_raw = hits.get("total", 0)
        total = (
            int(total_raw.get("value", 0))
            if isinstance(total_raw, dict)
            else int(total_raw or 0)
        )
        documents: list[dict[str, Any]] = []

        for hit in hits.get("hits", []):
            source = dict(hit.get("_source") or {})
            source["_id"] = hit.get("_id")
            source["_score"] = hit.get("_score")
            documents.append(source)

        return documents, total
