"""Async Elasticsearch client lifecycle."""

from typing import Optional

from elasticsearch import AsyncElasticsearch

from app.config import settings


class _ElasticsearchState:
    """Mutable holder for the process-wide client (avoids ``global``)."""

    client: Optional[AsyncElasticsearch] = None


_STATE = _ElasticsearchState()


def get_elasticsearch() -> AsyncElasticsearch:
    """Return a process-wide async Elasticsearch client."""

    if _STATE.client is not None:
        return _STATE.client

    username = settings.elasticsearch_username
    password = settings.elasticsearch_password

    if username and password:
        _STATE.client = AsyncElasticsearch(
            hosts=[settings.elasticsearch_url],
            basic_auth=(username, password),
        )
    else:
        _STATE.client = AsyncElasticsearch(
            hosts=[settings.elasticsearch_url],
        )

    return _STATE.client


async def close_elasticsearch() -> None:
    """Close the shared client if it was opened."""

    if _STATE.client is None:
        return

    await _STATE.client.close()
    _STATE.client = None
