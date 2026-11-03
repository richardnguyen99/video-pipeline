"""Video upload maintenance commands."""

from __future__ import annotations

import uuid
from typing import Annotated, Optional

import typer

from cli.async_utils import run_async
from cli.video_upload_activity import run_backfill_activity

app = typer.Typer(
    name="video-upload",
    help="Studio video upload maintenance commands.",
    no_args_is_help=True,
)


@app.command("backfill-activity")
def backfill_activity_command(
    dry_run: Annotated[
        bool,
        typer.Option(
            "--dry-run",
            help="Report rows that would be written without committing.",
        ),
    ] = False,
    limit: Annotated[
        Optional[int],
        typer.Option(
            "--limit",
            min=1,
            help="Process at most this many upload videos.",
        ),
    ] = None,
    video_id: Annotated[
        Optional[int],
        typer.Option(
            "--video-id",
            help="Backfill a single video primary key.",
        ),
    ] = None,
    public_id: Annotated[
        Optional[str],
        typer.Option(
            "--public-id",
            help="Backfill a single upload public_id (UUID).",
        ),
    ] = None,
) -> None:
    """Back-fill activity log rows for existing studio uploads.

    Derives timeline events from current video, rendition, and media rows:

    * Video uploads — ``upload_created`` / ``upload_completed``
    * Stream creation — ``stream_encoding_started`` / ``stream_ready``
    * Media uploads — thumbnail and sample upload / link events
    """

    parsed_public_id: uuid.UUID | None = None

    if public_id is not None:
        try:
            parsed_public_id = uuid.UUID(public_id)
        except ValueError as exc:
            typer.echo(f"Invalid --public-id: {public_id}", err=True)

            raise typer.Exit(code=1) from exc

    run_async(
        run_backfill_activity(
            dry_run=dry_run,
            limit=limit,
            video_id=video_id,
            public_id=parsed_public_id,
        ),
    )
