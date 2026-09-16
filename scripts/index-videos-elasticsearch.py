#!/usr/bin/env python3
"""Index videos from Postgres into Elasticsearch.

Prerequisites:
  docker compose --env-file .env.elasticsearch -f docker-compose.elasticsearch.yml up -d
  pip install -r backend/requirements.txt

Usage (from repository root):

  cd backend && python ../scripts/index-videos-elasticsearch.py
  cd backend && python ../scripts/index-videos-elasticsearch.py --recreate
  cd backend && python ../scripts/index-videos-elasticsearch.py --batch-size 100

Set elasticsearch_enabled=true and elasticsearch_url in backend/.env (or env).
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_ROOT))

from app.database import engine
from app.search.client import close_elasticsearch, get_elasticsearch
from app.search.indexer import VideoIndexer
from sqlmodel.ext.asyncio.session import AsyncSession


async def run(*, batch_size: int, recreate: bool) -> None:
    """Reindex all videos into Elasticsearch."""

    client = get_elasticsearch()

    try:
        info = await client.info()
        print(
            f"Connected to Elasticsearch {info.get('version', {}).get('number', '?')} "
            f"cluster={info.get('cluster_name', '?')}",
        )

        async with AsyncSession(engine) as session:
            indexer = VideoIndexer(client, session)
            total = await indexer.reindex_all(
                batch_size=batch_size,
                recreate=recreate,
            )

        print(f"Indexed {total} video document(s).")
    finally:
        await close_elasticsearch()


def main() -> None:
    """Parse CLI and run the indexer."""

    parser = argparse.ArgumentParser(
        description="Index video documents into Elasticsearch from Postgres.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=200,
        help="Postgres page size while streaming videos (default 200).",
    )
    parser.add_argument(
        "--recreate",
        action="store_true",
        help="Delete and recreate the videos index before indexing.",
    )
    args = parser.parse_args()
    batch_size = max(1, min(int(args.batch_size), 1000))

    asyncio.run(run(batch_size=batch_size, recreate=args.recreate))


if __name__ == "__main__":
    main()
