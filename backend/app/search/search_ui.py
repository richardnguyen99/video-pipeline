"""Map Elasticsearch hits into Search UI ResponseState shapes.

Used by the production proxy endpoints so ``ApiProxyConnector`` can talk to
FastAPI instead of Elasticsearch.

@see https://www.elastic.co/docs/reference/search-ui/api-connectors-elasticsearch
"""

from __future__ import annotations

from typing import Any, Optional


def _as_field(value: Any) -> dict[str, Any]:
    """Wrap a scalar / list value as a Search UI result field."""

    return {"raw": value}


def video_hit_to_result(document: dict[str, Any]) -> dict[str, Any]:
    """Convert a video ES ``_source`` (+ ``_id``) into a Search UI result."""

    doc_id = document.get("_id") or document.get("id")

    return {
        "id": _as_field(str(doc_id)),
        "video_id": _as_field(document.get("video_id")),
        "title": _as_field(document.get("title")),
        "title_akas": _as_field(document.get("title_akas")),
        "release_date": _as_field(document.get("release_date")),
        "actress_names": _as_field(document.get("actress_names")),
        "genre_names": _as_field(document.get("genre_names")),
        "series_names": _as_field(document.get("series_names")),
        "maker_names": _as_field(document.get("maker_names")),
        "label_names": _as_field(document.get("label_names")),
        "director_names": _as_field(document.get("director_names")),
        "image_url": _as_field(document.get("image_url")),
    }


def actress_hit_to_result(document: dict[str, Any]) -> dict[str, Any]:
    """Convert an actress ES ``_source`` (+ ``_id``) into a Search UI result."""

    doc_id = document.get("_id") or document.get("id")

    return {
        "id": _as_field(str(doc_id)),
        "name": _as_field(document.get("name")),
        "original_name": _as_field(document.get("original_name")),
        "dmm_name": _as_field(document.get("dmm_name")),
        "ruby": _as_field(document.get("ruby")),
        "aka_names": _as_field(document.get("aka_names")),
        "aka_translated_names": _as_field(
            document.get("aka_translated_names"),
        ),
    }


def build_search_response(
    results: list[dict[str, Any]],
    *,
    total_results: int,
    results_per_page: int,
) -> dict[str, Any]:
    """Build a Search UI ``ResponseState`` dict."""

    per_page = max(1, results_per_page)
    total_pages = (
        max(1, (total_results + per_page - 1) // per_page)
        if total_results > 0
        else 0
    )

    return {
        "results": results,
        "totalResults": total_results,
        "totalPages": total_pages,
        "resultSearchTerm": "",
        "facets": {},
        "requestId": "",
        "rawResponse": None,
    }


def build_autocomplete_response(
    results: list[dict[str, Any]],
    *,
    suggestion_field: str = "title",
) -> dict[str, Any]:
    """Build a Search UI ``AutocompleteResponseState`` dict."""

    suggestions: list[dict[str, str]] = []

    for result in results:
        field = result.get(suggestion_field) or {}
        raw = field.get("raw") if isinstance(field, dict) else None

        if isinstance(raw, list):
            text = next(
                (str(item).strip() for item in raw if item),
                "",
            )
        elif raw is not None:
            text = str(raw).strip()
        else:
            text = ""

        if text:
            suggestions.append({"suggestion": text})

    return {
        "autocompletedResults": results,
        "autocompletedSuggestions": {
            "documents": suggestions[:10],
        },
        "autocompletedResultsRequestId": "",
        "autocompletedSuggestionsRequestId": "",
    }


def resolve_page(
    state_current: int,
    state_size: int,
    config_size: Optional[int],
) -> tuple[int, int, int]:
    """Return ``(page, size, offset)`` from Search UI state + config."""

    size = config_size if config_size is not None else state_size
    size = max(1, min(int(size), 100))
    page = max(1, int(state_current))
    offset = (page - 1) * size

    return page, size, offset
