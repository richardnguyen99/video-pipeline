"""Search UI production proxy endpoints.

Exposes separate ``/search`` and ``/autocomplete`` routes for videos and
actresses. The browser uses ``ApiProxyConnector`` (or our connector) against
these paths; FastAPI talks to Elasticsearch server-side.

@see https://www.elastic.co/docs/reference/search-ui/tutorials-elasticsearch-production-usage
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.config import settings
from app.schemas.search_ui import SearchUIProxyBody
from app.search.actress_service import ActressSearchService
from app.search.client import get_elasticsearch
from app.search.search_ui import (
    actress_hit_to_result,
    build_autocomplete_response,
    build_search_response,
    resolve_page,
    video_hit_to_result,
)
from app.search.service import VideoSearchService

router = APIRouter(prefix="/search-ui")


def _require_elasticsearch() -> None:
    if not settings.elasticsearch_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Elasticsearch is disabled. Set ELASTICSEARCH_ENABLED=true "
                "and restart the API."
            ),
        )


def get_video_search_service() -> VideoSearchService:
    """Build a request-scoped video ES search service."""

    _require_elasticsearch()

    return VideoSearchService(get_elasticsearch())


def get_actress_search_service() -> ActressSearchService:
    """Build a request-scoped actress ES search service."""

    _require_elasticsearch()

    return ActressSearchService(get_elasticsearch())


VideoSearchServiceDep = Annotated[
    VideoSearchService,
    Depends(get_video_search_service),
]
ActressSearchServiceDep = Annotated[
    ActressSearchService,
    Depends(get_actress_search_service),
]


@router.post(
    "/videos/search",
    summary="Search UI: video search",
    status_code=status.HTTP_200_OK,
)
async def search_videos(
    body: SearchUIProxyBody,
    service: VideoSearchServiceDep,
) -> dict[str, Any]:
    """Proxy Search UI video search to the videos Elasticsearch index."""

    state = body.state
    config = body.queryConfig
    _page, size, offset = resolve_page(
        state.current,
        state.resultsPerPage,
        config.resultsPerPage,
    )
    documents, total = await service.search_documents(
        query_text=state.searchTerm,
        limit=size,
        offset=offset,
    )
    results = [video_hit_to_result(doc) for doc in documents]
    response = build_search_response(
        results,
        total_results=total,
        results_per_page=size,
    )
    response["resultSearchTerm"] = state.searchTerm

    return response


@router.post(
    "/videos/autocomplete",
    summary="Search UI: video autocomplete",
    status_code=status.HTTP_200_OK,
)
async def autocomplete_videos(
    body: SearchUIProxyBody,
    service: VideoSearchServiceDep,
) -> dict[str, Any]:
    """Proxy Search UI video autocomplete to Elasticsearch."""

    state = body.state
    config = body.queryConfig
    results_cfg = config.results or {}
    size = int(results_cfg.get("resultsPerPage") or config.resultsPerPage or 6)
    size = max(1, min(size, 20))
    documents, _total = await service.search_documents(
        query_text=state.searchTerm,
        limit=size,
        offset=0,
    )
    results = [video_hit_to_result(doc) for doc in documents]

    return build_autocomplete_response(results, suggestion_field="title")


@router.post(
    "/actresses/search",
    summary="Search UI: actress search",
    status_code=status.HTTP_200_OK,
)
async def search_actresses(
    body: SearchUIProxyBody,
    service: ActressSearchServiceDep,
) -> dict[str, Any]:
    """Proxy Search UI actress search to the actresses Elasticsearch index."""

    state = body.state
    config = body.queryConfig
    _page, size, offset = resolve_page(
        state.current,
        state.resultsPerPage,
        config.resultsPerPage,
    )
    documents, total = await service.search_documents(
        query_text=state.searchTerm,
        limit=size,
        offset=offset,
    )
    results = [actress_hit_to_result(doc) for doc in documents]
    response = build_search_response(
        results,
        total_results=total,
        results_per_page=size,
    )
    response["resultSearchTerm"] = state.searchTerm

    return response


@router.post(
    "/actresses/autocomplete",
    summary="Search UI: actress autocomplete",
    status_code=status.HTTP_200_OK,
)
async def autocomplete_actresses(
    body: SearchUIProxyBody,
    service: ActressSearchServiceDep,
) -> dict[str, Any]:
    """Proxy Search UI actress autocomplete to Elasticsearch."""

    state = body.state
    config = body.queryConfig
    results_cfg = config.results or {}
    size = int(results_cfg.get("resultsPerPage") or config.resultsPerPage or 6)
    size = max(1, min(size, 20))
    documents, _total = await service.search_documents(
        query_text=state.searchTerm,
        limit=size,
        offset=0,
    )
    results = [actress_hit_to_result(doc) for doc in documents]

    return build_autocomplete_response(results, suggestion_field="name")
