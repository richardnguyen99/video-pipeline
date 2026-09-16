#!/usr/bin/env python3
"""Compute and persist pre-ranked video recommendations.

Modes:

  Full backfill (all videos):
    cd backend && python ../scripts/compute-video-recommendations.py

  Only videos with no recommendation rows yet (new inserts):
    cd backend && python ../scripts/compute-video-recommendations.py --new-only

  Videos created after a timestamp:
    cd backend && python ../scripts/compute-video-recommendations.py \\
      --since '2026-09-15T00:00:00'

  Single video:
    cd backend && python ../scripts/compute-video-recommendations.py --video-id 123

  Also refresh sources that share actresses/series with the targets
  (so new titles can appear in existing sidebars):
    ... --refresh-related

Requires DATABASE_URL (or app settings env) for the catalog DB.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from datetime import datetime
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_ROOT))

from app.database import engine
from app.models.video import Video
from app.repositories.video import VideoRepository
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession


def parse_since(value: str) -> datetime:
    """Parse an ISO-8601 or ``YYYY-MM-DD`` timestamp."""

    normalized = value.strip().replace("Z", "+00:00")

    if len(normalized) == 10 and normalized[4] == "-" and normalized[7] == "-":
        return datetime.fromisoformat(f"{normalized}T00:00:00")

    return datetime.fromisoformat(normalized)


async def resolve_target_ids(
    repository: VideoRepository,
    session: AsyncSession,
    *,
    video_id: int | None,
    new_only: bool,
    since: datetime | None,
) -> list[int]:
    """Resolve which source video ids to recompute."""

    if video_id is not None:
        return [video_id]

    if new_only:
        return await repository.list_video_ids_missing_recommendations()

    if since is not None:
        return await repository.list_video_ids_created_since(since)

    rows = (
        await session.exec(select(col(Video.id)).order_by(col(Video.id).asc()))
    ).all()

    return [int(row) for row in rows]


async def expand_with_related(
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


async def run(
    *,
    limit: int,
    video_id: int | None,
    new_only: bool,
    since: datetime | None,
    refresh_related: bool,
) -> None:
    """Recompute recommendation rows for the selected video set."""

    async with AsyncSession(engine) as session:
        repository = VideoRepository(session=session)
        target_ids = await resolve_target_ids(
            repository,
            session,
            video_id=video_id,
            new_only=new_only,
            since=since,
        )

        if not target_ids:
            print("No videos to process.")

            return

        process_ids = (
            await expand_with_related(repository, target_ids)
            if refresh_related
            else target_ids
        )
        total = len(process_ids)
        written = 0

        print(
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
            print(f"[{index}/{total}] video_id={current_id} -> {count} rows")

        print(f"Done. Stored {written} recommendation row(s).")


def main() -> None:
    """Parse CLI args and run the async job."""

    parser = argparse.ArgumentParser(
        description=(
            "Pre-compute video recommendation rows into video_recommendation. "
            "Use --new-only or --since for incremental jobs after inserts."
        ),
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=50,
        help="Max recommendations stored per source video (1–50, default 50).",
    )
    parser.add_argument(
        "--video-id",
        type=int,
        default=None,
        help="Only recompute for this Video.id.",
    )
    parser.add_argument(
        "--new-only",
        action="store_true",
        help="Only videos that still have zero recommendation rows.",
    )
    parser.add_argument(
        "--since",
        type=str,
        default=None,
        help="Only videos with created_at after this ISO timestamp / YYYY-MM-DD.",
    )
    parser.add_argument(
        "--refresh-related",
        action="store_true",
        help=(
            "Also recompute sources that share actresses or series with the "
            "target videos so new titles can appear in existing sidebars."
        ),
    )
    args = parser.parse_args()

    mode_flags = sum(
        1
        for flag in (args.video_id is not None, args.new_only, bool(args.since))
        if flag
    )

    if mode_flags > 1:
        parser.error("Use only one of --video-id, --new-only, or --since.")

    limit = max(1, min(int(args.limit), 50))
    since = parse_since(args.since) if args.since else None

    asyncio.run(
        run(
            limit=limit,
            video_id=args.video_id,
            new_only=args.new_only,
            since=since,
            refresh_related=args.refresh_related,
        ),
    )


if __name__ == "__main__":
    main()
