"""Query the actresses Elasticsearch index."""

from __future__ import annotations

from typing import Any, Optional

from elasticsearch import AsyncElasticsearch

from app.config import settings
from app.utils.common import search_terms

_MATCH_FIELDS: list[str] = [
    "name^5",
    "ruby^3",
    "original_name^2",
    "dmm_name^2",
    "aka_names^2",
    "aka_translated_names^3",
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
        """``ILIKE %term%`` style match on keyword fields."""

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
        """Match one term on name / ruby / aka fields."""

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
                    "name": {
                        "query": term,
                        "boost": 6,
                    },
                },
            },
            {
                "match_phrase": {
                    "aka_translated_names": {
                        "query": term,
                        "boost": 4,
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
        """AND across split terms."""

        terms = search_terms(query_text)

        if not terms:
            return []

        return [self._term_clause(term) for term in terms]

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
        fields = source_fields or [
            "id",
            "name",
            "original_name",
            "dmm_name",
            "ruby",
            "aka_names",
            "aka_translated_names",
        ]

        response = await self._client.search(
            index=self._index,
            query={"bool": {"must": must}},
            from_=max(0, offset),
            size=max(1, min(limit, 100)),
            sort=["_score", {"id": {"order": "asc"}}],
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
