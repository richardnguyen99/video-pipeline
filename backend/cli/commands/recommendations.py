"""Recommendation pre-compute commands."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Optional

import typer
from sqlmodel import col, select

from app.models.video import Video
from app.repositories.video import VideoRepository
from cli.async_utils import run_async
from cli.db import session_scope

app = typer.Typer(
    name="recommendations",
    help="Pre-compute and persist video recommendation rows.",
    no_args_is_help=True,
)


def parse_since(value: str) -> datetime:
    """Parse an ISO-8601 or ``YYYY-MM-DD`` timestamp."""

    normalized = value.strip().replace("Z", "+00:00")

    if len(normalized) == 10 and normalized[4] == "-" and normalized[7] == "-":
        return datetime.fromisoformat(f"{normalized}T00:00:00")

    return datetime.fromisoformat(normalized)


async def _expand_with_related(
    repository: VideoRepository,
    target_ids: list[int],
) -> list[int]:
    """Union targets with videos that share actresses or series."""

    expanded: set[int] = set(target_ids)

    for current_id in target_ids:
        related = await repository.list_related_recommendation_source_ids(
            current_id,
        )
        expanded.update(related)

    return sorted(expanded)


async def _compute(
    *,
    limit: int,
    video_id: int | None,
    new_only: bool,
    since: datetime | None,
    refresh_related: bool,
) -> None:
    """Recompute recommendation rows for the selected video set."""

    async with session_scope() as session:
        repository = VideoRepository(session=session)

        if video_id is not None:
            target_ids = [video_id]
        elif new_only:
            target_ids = (
                await repository.list_video_ids_missing_recommendations()
            )
        elif since is not None:
            target_ids = await repository.list_video_ids_created_since(since)
        else:
            rows = (
                await session.exec(
                    select(col(Video.id)).order_by(col(Video.id).asc()),
                )
            ).all()
            target_ids = [int(row) for row in rows]

        if not target_ids:
            typer.echo("No videos to process.")

            return

        process_ids = (
            await _expand_with_related(repository, target_ids)
            if refresh_related
            else target_ids
        )
        total = len(process_ids)
        written = 0

        typer.echo(
            f"Computing recommendations for {total} video(s), "
            f"limit={limit}, targets={len(target_ids)}, "
            f"refresh_related={refresh_related}",
        )

        for index, current_id in enumerate(process_ids, start=1):
            count = await repository.replace_recommendations_for_video(
                current_id,
                limit=limit,
            )
            written += count
            typer.echo(
                f"[{index}/{total}] video_id={current_id} -> {count} rows"
            )

        typer.echo(f"Done. Stored {written} recommendation row(s).")


@app.command("compute")
def compute_command(
    limit: Annotated[
        int,
        typer.Option(
            "--limit",
            min=1,
            max=50,
            help="Max recommendations stored per source video (1–50).",
        ),
    ] = 50,
    video_id: Annotated[
        Optional[int],
        typer.Option("--video-id", help="Only recompute for this Video.id."),
    ] = None,
    new_only: Annotated[
        bool,
        typer.Option(
            "--new-only",
            help="Only videos that still have zero recommendation rows.",
        ),
    ] = False,
    since: Annotated[
        Optional[str],
        typer.Option(
            "--since",
            help="Only videos with created_at after this ISO timestamp / YYYY-MM-DD.",
        ),
    ] = None,
    refresh_related: Annotated[
        bool,
        typer.Option(
            "--refresh-related",
            help=(
                "Also recompute sources that share actresses or series with "
                "the target videos."
            ),
        ),
    ] = False,
) -> None:
    """Compute and persist ranked recommendations into video_recommendation."""

    mode_flags = sum(
        1 for flag in (video_id is not None, new_only, bool(since)) if flag
    )

    if mode_flags > 1:
        raise typer.BadParameter(
            "Use only one of --video-id, --new-only, or --since.",
        )

    since_dt = parse_since(since) if since else None
    safe_limit = max(1, min(limit, 50))

    run_async(
        _compute(
            limit=safe_limit,
            video_id=video_id,
            new_only=new_only,
            since=since_dt,
            refresh_related=refresh_related,
        ),
    )
