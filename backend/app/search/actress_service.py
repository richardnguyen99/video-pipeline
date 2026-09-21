"""Query the actresses Elasticsearch index."""

from __future__ import annotations

from typing import Any, Optional

from elasticsearch import AsyncElasticsearch

from app.config import settings
from app.schemas.actress_filters import ActressSort
from app.utils.common import search_terms

_MATCH_FIELDS: list[str] = [
    "name^8",
    "aka_translated_names^5",
    "ruby^4",
    "original_name^3",
    "dmm_name^3",
    "aka_names^2",
]

_SUBSTRING_FIELDS: list[str] = [
    "name.keyword",
    "ruby.keyword",
]


class ActressSearchService:
    """Full-text search against the actresses index."""

    def __init__(
        self,
        client: AsyncElasticsearch,
        *,
        index_name: Optional[str] = None,
    ) -> None:
        self._client = client
        self._index = index_name or settings.elasticsearch_index_actresses

    def _substring_should(self, term: str) -> list[dict[str, Any]]:
        """Lower-weight ``ILIKE %term%`` style match on keyword fields."""

        if len(term) < 2:
            return []

        pattern = f"*{term.lower()}*"

        return [
            {
                "wildcard": {
                    field: {
                        "value": pattern,
                        "case_insensitive": True,
                        "boost": 0.35,
                    },
                },
            }
            for field in _SUBSTRING_FIELDS
        ]

    def _term_clause(self, term: str) -> dict[str, Any]:
        """Match one term with strong preference for exact / phrase name hits."""

        should: list[dict[str, Any]] = [
            {
                "term": {
                    "name.keyword": {
                        "value": term,
                        "boost": 24,
                        "case_insensitive": True,
                    },
                },
            },
            {
                "match_phrase": {
                    "name": {
                        "query": term,
                        "boost": 12,
                    },
                },
            },
            {
                "match_phrase": {
                    "aka_translated_names": {
                        "query": term,
                        "boost": 8,
                    },
                },
            },
            {
                "match_phrase": {
                    "ruby": {
                        "query": term,
                        "boost": 6,
                    },
                },
            },
            {
                "multi_match": {
                    "query": term,
                    "fields": _MATCH_FIELDS,
                    "type": "best_fields",
                    "operator": "and",
                    "boost": 2,
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
        """AND across split terms."""

        terms = search_terms(query_text)

        if not terms:
            return []

        return [self._term_clause(term) for term in terms]

    def _ranked_query(self, must: list[dict[str, Any]]) -> dict[str, Any]:
        """Combine name relevancy with video count, details, and image quality."""

        return {
            "function_score": {
                "query": {"bool": {"must": must}},
                "functions": [
                    {
                        "field_value_factor": {
                            "field": "video_cnt",
                            "modifier": "log1p",
                            "factor": 2.0,
                            "missing": 0,
                        },
                    },
                    {
                        "filter": {"term": {"has_image": True}},
                        "weight": 2.5,
                    },
                    {
                        "filter": {"term": {"has_details": True}},
                        "weight": 1.5,
                    },
                ],
                "score_mode": "sum",
                "boost_mode": "multiply",
            },
        }

    def _sort_clause(
        self,
        sort: Optional[ActressSort] = None,
    ) -> list[str | dict[str, Any]]:
        """Map app sort values to Elasticsearch sort."""

        if sort == ActressSort.ID:
            return [{"id": {"order": "asc"}}]

        return [
            "_score",
            {"video_cnt": {"order": "desc"}},
            {"id": {"order": "asc"}},
        ]

    async def search_actress_ids(
        self,
        *,
        query_text: str,
        limit: int = 20,
        offset: int = 0,
        sort: Optional[ActressSort] = None,
    ) -> tuple[list[int], int]:
        """Return ordered actress primary keys and total hits for a text query."""

        text = (query_text or "").strip()
        must: list[dict[str, Any]] = (
            self._text_must_clauses(text) if text else [{"match_all": {}}]
        )
        query = self._ranked_query(must) if text else {"bool": {"must": must}}

        response = await self._client.search(
            index=self._index,
            query=query,
            from_=max(0, offset),
            size=max(1, min(limit, 100)),
            sort=self._sort_clause(sort),
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
        """Return actress documents and total hits for Search UI."""

        text = (query_text or "").strip()
        must: list[dict[str, Any]] = (
            self._text_must_clauses(text) if text else [{"match_all": {}}]
        )
        query = self._ranked_query(must) if text else {"bool": {"must": must}}
        fields = source_fields or [
            "id",
            "name",
            "original_name",
            "dmm_name",
            "ruby",
            "aka_names",
            "aka_translated_names",
            "video_cnt",
            "has_image",
            "has_details",
            "image_url",
        ]

        response = await self._client.search(
            index=self._index,
            query=query,
            from_=max(0, offset),
            size=max(1, min(limit, 100)),
            sort=[
                "_score",
                {"video_cnt": {"order": "desc"}},
                {"id": {"order": "asc"}},
            ],
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
