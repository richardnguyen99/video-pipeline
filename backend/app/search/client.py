"""Async Elasticsearch client lifecycle."""

from typing import Optional

from elasticsearch import AsyncElasticsearch

from app.config import settings

_client: Optional[AsyncElasticsearch] = None


def get_elasticsearch() -> AsyncElasticsearch:
    """Return a process-wide async Elasticsearch client."""

    global _client

    if _client is None:
        kwargs: dict[str, object] = {
            "hosts": [settings.elasticsearch_url],
        }

        if settings.elasticsearch_username and settings.elasticsearch_password:
            kwargs["basic_auth"] = (
                settings.elasticsearch_username,
                settings.elasticsearch_password,
            )

        _client = AsyncElasticsearch(**kwargs)

    return _client


async def close_elasticsearch() -> None:
    """Close the shared client if it was opened."""

    global _client

    if _client is not None:
        await _client.close()
        _client = None
