"""Elasticsearch index management commands."""

from __future__ import annotations

from typing import Annotated

import typer

from app.search.client import close_elasticsearch, get_elasticsearch
from app.search.indexer import VideoIndexer
from cli.async_utils import run_async
from cli.db import session_scope

app = typer.Typer(
    name="elasticsearch",
    help="Manage the videos Elasticsearch index.",
    no_args_is_help=True,
)


async def _index(*, batch_size: int, recreate: bool) -> None:
    """Reindex all videos into Elasticsearch."""

    client = get_elasticsearch()

    try:
        info = await client.info()
        version = info.get("version", {}).get("number", "?")
        cluster = info.get("cluster_name", "?")
        typer.echo(f"Connected to Elasticsearch {version} cluster={cluster}")

        async with session_scope() as session:
            indexer = VideoIndexer(client, session)
            total = await indexer.reindex_all(
                batch_size=batch_size,
                recreate=recreate,
            )

        typer.echo(f"Indexed {total} video document(s).")
    finally:
        await close_elasticsearch()


@app.command("index")
def index_command(
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

    run_async(_index(batch_size=batch_size, recreate=recreate))
