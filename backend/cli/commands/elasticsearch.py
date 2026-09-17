"""Elasticsearch index management commands."""

from __future__ import annotations

from typing import Annotated

import typer
from elasticsearch import AsyncElasticsearch

from app.search.actress_indexer import ActressIndexer
from app.search.client import close_elasticsearch, get_elasticsearch
from app.search.indexer import VideoIndexer
from cli.async_utils import run_async
from cli.db import session_scope

app = typer.Typer(
    name="elasticsearch",
    help="Manage Elasticsearch indexes for catalog search.",
    no_args_is_help=True,
)


async def _connect_banner() -> AsyncElasticsearch:
    """Open the client and print cluster info; returns the client."""

    client = get_elasticsearch()
    info = await client.info()
    version = info.get("version", {}).get("number", "?")
    cluster = info.get("cluster_name", "?")
    typer.echo(f"Connected to Elasticsearch {version} cluster={cluster}")

    return client


async def _index_videos(*, batch_size: int, recreate: bool) -> None:
    """Reindex all videos into Elasticsearch."""

    client = await _connect_banner()

    try:
        async with session_scope() as session:
            indexer = VideoIndexer(client, session)
            total = await indexer.reindex_all(
                batch_size=batch_size,
                recreate=recreate,
            )

        typer.echo(f"Indexed {total} video document(s).")
    finally:
        await close_elasticsearch()


async def _index_actresses(*, batch_size: int, recreate: bool) -> None:
    """Reindex all actresses into Elasticsearch."""

    client = await _connect_banner()

    try:
        async with session_scope() as session:
            indexer = ActressIndexer(client, session)
            total = await indexer.reindex_all(
                batch_size=batch_size,
                recreate=recreate,
            )

        typer.echo(f"Indexed {total} actress document(s).")
    finally:
        await close_elasticsearch()


@app.command("index")
@app.command("index-videos")
def index_videos_command(
    batch_size: Annotated[
        int,
        typer.Option(
            "--batch-size",
            min=1,
            max=1000,
            help="Postgres page size while streaming videos.",
        ),
    ] = 200,
    recreate: Annotated[
        bool,
        typer.Option(
            "--recreate",
            help="Delete and recreate the videos index before indexing.",
        ),
    ] = False,
) -> None:
    """Index video documents from Postgres into Elasticsearch."""

    run_async(_index_videos(batch_size=batch_size, recreate=recreate))


@app.command("index-actresses")
def index_actresses_command(
    batch_size: Annotated[
        int,
        typer.Option(
            "--batch-size",
            min=1,
            max=1000,
            help="Postgres page size while streaming actresses.",
        ),
    ] = 200,
    recreate: Annotated[
        bool,
        typer.Option(
            "--recreate",
            help="Delete and recreate the actresses index before indexing.",
        ),
    ] = False,
) -> None:
    """Index actress documents from Postgres into Elasticsearch."""

    run_async(_index_actresses(batch_size=batch_size, recreate=recreate))
