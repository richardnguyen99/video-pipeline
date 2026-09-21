"""Elasticsearch index settings and field mappings."""

from __future__ import annotations

from typing import Any

VIDEOS_INDEX_SETTINGS: dict[str, Any] = {
    "number_of_shards": 1,
    "number_of_replicas": 0,
    "analysis": {
        "analyzer": {
            "video_text": {
                "type": "custom",
                "tokenizer": "standard",
                "filter": ["lowercase", "asciifolding", "cjk_width"],
            },
        },
        "normalizer": {
            "video_keyword": {
                "type": "custom",
                "filter": ["lowercase", "asciifolding"],
            },
        },
    },
}

_TEXT: dict[str, Any] = {
    "type": "text",
    "analyzer": "video_text",
}

_TEXT_WITH_KEYWORD: dict[str, Any] = {
    "type": "text",
    "analyzer": "video_text",
    "fields": {
        "keyword": {
            "type": "keyword",
            "normalizer": "video_keyword",
            "ignore_above": 256,
        },
    },
}

VIDEOS_INDEX_MAPPINGS: dict[str, Any] = {
    "properties": {
        "id": {"type": "integer"},
        "video_id": {
            "type": "text",
            "analyzer": "video_text",
            "fields": {
                "keyword": {
                    "type": "keyword",
                    "normalizer": "video_keyword",
                    "ignore_above": 64,
                },
            },
        },
        "title": dict(_TEXT_WITH_KEYWORD),
        "title_akas": dict(_TEXT),
        "release_date": {"type": "date"},
        "actress_ids": {"type": "integer"},
        "actress_names": dict(_TEXT_WITH_KEYWORD),
        "genre_ids": {"type": "integer"},
        "genre_names": dict(_TEXT_WITH_KEYWORD),
        "series_ids": {"type": "integer"},
        "series_names": dict(_TEXT_WITH_KEYWORD),
        "maker_ids": {"type": "integer"},
        "maker_names": dict(_TEXT_WITH_KEYWORD),
        "label_ids": {"type": "integer"},
        "label_names": dict(_TEXT_WITH_KEYWORD),
        "director_ids": {"type": "integer"},
        "director_names": dict(_TEXT_WITH_KEYWORD),
        "search_blob": dict(_TEXT_WITH_KEYWORD),
        "image_url": {"type": "keyword", "index": False},
    },
}

ACTRESSES_INDEX_SETTINGS: dict[str, Any] = {
    "number_of_shards": 1,
    "number_of_replicas": 0,
    "analysis": {
        "analyzer": {
            "actress_text": {
                "type": "custom",
                "tokenizer": "standard",
                "filter": ["lowercase", "asciifolding", "cjk_width"],
            },
        },
        "normalizer": {
            "actress_keyword": {
                "type": "custom",
                "filter": ["lowercase", "asciifolding"],
            },
        },
    },
}

_ACTRESS_TEXT: dict[str, Any] = {
    "type": "text",
    "analyzer": "actress_text",
}

_ACTRESS_TEXT_WITH_KEYWORD: dict[str, Any] = {
    "type": "text",
    "analyzer": "actress_text",
    "fields": {
        "keyword": {
            "type": "keyword",
            "normalizer": "actress_keyword",
            "ignore_above": 256,
        },
    },
}

ACTRESSES_INDEX_MAPPINGS: dict[str, Any] = {
    "properties": {
        "id": {"type": "integer"},
        "name": dict(_ACTRESS_TEXT_WITH_KEYWORD),
        "original_name": dict(_ACTRESS_TEXT),
        "dmm_name": dict(_ACTRESS_TEXT),
        "dmm_id": {"type": "keyword"},
        "ruby": dict(_ACTRESS_TEXT_WITH_KEYWORD),
        "aka_names": dict(_ACTRESS_TEXT),
        "aka_translated_names": dict(_ACTRESS_TEXT),
        "video_cnt": {"type": "integer"},
        "has_image": {"type": "boolean"},
        "has_details": {"type": "boolean"},
        "image_url": {"type": "keyword", "index": False},
    },
}
