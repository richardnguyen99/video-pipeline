"""Elasticsearch helpers for catalog search."""

from app.search.actress_indexer import ActressIndexer
from app.search.actress_service import ActressSearchService
from app.search.client import close_elasticsearch, get_elasticsearch
from app.search.indexer import (
    VideoIndexer,
    remove_video_search_document,
    sync_video_search_document,
)
from app.search.service import VideoSearchService

__all__ = [
    "ActressIndexer",
    "ActressSearchService",
    "VideoIndexer",
    "VideoSearchService",
    "close_elasticsearch",
    "get_elasticsearch",
    "remove_video_search_document",
    "sync_video_search_document",
]
