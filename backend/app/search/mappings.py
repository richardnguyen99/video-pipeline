"""Index mappings for catalog search documents."""

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
            "ignore_above": 512,
        },
    },
}

VIDEOS_INDEX_MAPPINGS: dict[str, Any] = {
    "properties": {
        "id": {"type": "integer"},
        "video_id": {
            "type": "keyword",
            "normalizer": "video_keyword",
            "fields": {
                "text": dict(_TEXT),
            },
        },
        "title": dict(_TEXT_WITH_KEYWORD),
        "title_akas": dict(_TEXT_WITH_KEYWORD),
        "release_date": {
            "type": "date",
            "format": "strict_date_optional_time||epoch_millis",
        },
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
    },
}
