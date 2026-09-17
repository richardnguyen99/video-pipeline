"""Request / response shapes for Search UI API proxy endpoints.

Matches ``ApiProxyConnector`` body and Search UI ResponseState /
AutocompleteResponseState so the browser never talks to Elasticsearch
directly.

@see https://www.elastic.co/docs/reference/search-ui/tutorials-elasticsearch-production-usage
"""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class SearchUIRequestState(BaseModel):
    """Subset of Search UI ``RequestState`` used by the proxy."""

    searchTerm: str = ""
    current: int = Field(default=1, ge=1)
    resultsPerPage: int = Field(default=20, ge=1, le=100)
    filters: list[Any] = Field(default_factory=list)
    sortList: list[Any] = Field(default_factory=list)


class SearchUIQueryConfig(BaseModel):
    """Subset of Search UI ``QueryConfig`` / autocomplete query config."""

    resultsPerPage: Optional[int] = Field(default=None, ge=1, le=100)
    result_fields: Optional[dict[str, Any]] = None
    search_fields: Optional[dict[str, Any]] = None
    suggestions: Optional[dict[str, Any]] = None
    results: Optional[dict[str, Any]] = None


class SearchUIProxyBody(BaseModel):
    """Body posted by ``ApiProxyConnector`` to ``/search`` and ``/autocomplete``."""

    state: SearchUIRequestState = Field(default_factory=SearchUIRequestState)
    queryConfig: SearchUIQueryConfig = Field(
        default_factory=SearchUIQueryConfig,
    )
