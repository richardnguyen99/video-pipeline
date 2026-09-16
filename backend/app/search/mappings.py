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
                "filter": ["lowercase", "asciifolding"],
            },
        },
    },
}

VIDEOS_INDEX_MAPPINGS: dict[str, Any] = {
    "properties": {
        "id": {"type": "integer"},
        "video_id": {
            "type": "keyword",
            "fields": {
                "text": {"type": "text", "analyzer": "video_text"},
            },
        },
        "title": {
            "type": "text",
            "analyzer": "video_text",
            "fields": {
                "keyword": {"type": "keyword", "ignore_above": 512},
            },
        },
        "title_akas": {"type": "text", "analyzer": "video_text"},
        "release_date": {
            "type": "date",
            "format": "strict_date_optional_time||epoch_millis",
        },
        "actress_ids": {"type": "integer"},
        "actress_names": {"type": "text", "analyzer": "video_text"},
        "genre_ids": {"type": "integer"},
        "genre_names": {"type": "text", "analyzer": "video_text"},
        "series_ids": {"type": "integer"},
        "series_names": {"type": "text", "analyzer": "video_text"},
        "maker_ids": {"type": "integer"},
        "maker_names": {"type": "text", "analyzer": "video_text"},
        "label_ids": {"type": "integer"},
        "label_names": {"type": "text", "analyzer": "video_text"},
        "director_ids": {"type": "integer"},
        "director_names": {"type": "text", "analyzer": "video_text"},
    },
}
