"""Recommendation helpers for ``VideoRepository``."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import Table, and_, case, delete, func, or_
from sqlalchemy import select as sa_select
from sqlalchemy.sql import ColumnElement
from sqlalchemy.sql.selectable import ScalarSelect
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.associations import (
    t_video_actress,
    t_video_genre,
    t_video_label,
    t_video_maker,
    t_video_series,
)
from app.models.video import (
    Video,
    VideoImageUrl,
)
from app.models.video_recommendation import VideoRecommendation
from app.utils.common import media_load


class VideoRecommendationMixin:
    """Pre-computed and live recommendation ranking for videos.

    Expects to be mixed into a repository that provides ``session`` and
    ``association_fk_ids``.
    """

    session: AsyncSession

    async def association_fk_ids(
        self,
        table: Table,
        video_id: int,
    ) -> list[int]:
        """Return association ``fk_id`` values linked to ``video_id``.

        Implemented by ``VideoRepository``; declared here for typing.
        """

        raise NotImplementedError

    @staticmethod
    def _shared_entity_count(
        table: Table,
        seed_ids: list[int],
    ) -> ScalarSelect[int]:
        """Correlated count of shared association rows for a candidate video."""

        if not seed_ids:
            return sa_select(func.coalesce(0, 0)).scalar_subquery()

        return (
            sa_select(func.count())
            .select_from(table)
            .where(
                table.c.video_id == col(Video.id),
                table.c.fk_id.in_(seed_ids),
            )
            .correlate(Video)
            .scalar_subquery()
        )

    async def list_recommended_for_video(
        self,
        video_id: int,
        *,
        limit: int = 12,
    ) -> list[Video]:
        """Return recommendations for ``video_id``.

        Prefers pre-computed ``video_recommendation`` rows. When none exist
        (e.g. a newly inserted video not yet processed by the offline job),
        falls back to the live ranking query so the sidebar is never empty.

        Args:
            video_id: Source ``Video.id`` primary key.
            limit: Maximum number of recommendations to return.

        Returns:
            Ordered ``Video`` rows with ``video_image_url`` loaded.
        """

        safe_limit = max(1, min(limit, 50))
        image_options = media_load(
            Video.video_image_url,
            VideoImageUrl.id,
            VideoImageUrl.url,
            VideoImageUrl.type,
        )

        precomputed_statement = (
            select(Video)
            .join(
                VideoRecommendation,
                col(VideoRecommendation.recommended_video_id) == col(Video.id),
            )
            .where(
                col(VideoRecommendation.video_id) == video_id,
                col(Video.visibility) == "public",
            )
            .order_by(
                col(VideoRecommendation.rank).asc(),
            )
            .options(image_options)
            .limit(safe_limit)
        )
        precomputed = list(
            (await self.session.exec(precomputed_statement)).all()
        )

        if precomputed:
            return precomputed

        candidates = await self.compute_recommendation_candidates(
            video_id,
            limit=safe_limit,
        )

        if not candidates:
            return []

        candidate_ids = [recommended_id for recommended_id, _ in candidates]
        live_statement = (
            select(Video)
            .where(col(Video.id).in_(candidate_ids))
            .options(image_options)
        )
        loaded = list((await self.session.exec(live_statement)).all())
        by_id = {video.id: video for video in loaded}

        return [
            by_id[recommended_id]
            for recommended_id in candidate_ids
            if recommended_id in by_id
        ]

    async def _source_catalog_ids(
        self,
        video_id: int,
    ) -> dict[str, list[int]]:
        """Load association foreign keys used for recommendation ranking."""

        return {
            "actress": await self.association_fk_ids(
                t_video_actress,
                video_id,
            ),
            "genre": await self.association_fk_ids(t_video_genre, video_id),
            "series": await self.association_fk_ids(t_video_series, video_id),
            "label": await self.association_fk_ids(t_video_label, video_id),
            "maker": await self.association_fk_ids(t_video_maker, video_id),
        }

    def _recommendation_shared_counts(
        self,
        catalog_ids: dict[str, list[int]],
    ) -> dict[str, ScalarSelect[Any]]:
        """Build shared-entity count subqueries for each catalog dimension."""

        return {
            "actress": self._shared_entity_count(
                t_video_actress,
                catalog_ids["actress"],
            ),
            "genre": self._shared_entity_count(
                t_video_genre,
                catalog_ids["genre"],
            ),
            "series": self._shared_entity_count(
                t_video_series,
                catalog_ids["series"],
            ),
            "label": self._shared_entity_count(
                t_video_label,
                catalog_ids["label"],
            ),
            "maker": self._shared_entity_count(
                t_video_maker,
                catalog_ids["maker"],
            ),
        }

    @staticmethod
    def _release_window_expressions(
        source_release: datetime | None,
    ) -> tuple[ColumnElement[Any], ColumnElement[Any]]:
        """Return (in_window, delta_days) expressions for release ranking."""

        release_window = timedelta(days=183)

        if source_release is None:
            return (
                case((col(Video.id) == -1, 1), else_=0),
                case(
                    (col(Video.release_date).is_(None), 99999.0),
                    else_=99999.0,
                ),
            )

        window_low = source_release - release_window
        window_high = source_release + release_window

        return (
            case(
                (
                    and_(
                        col(Video.release_date).is_not(None),
                        col(Video.release_date) >= window_low,
                        col(Video.release_date) <= window_high,
                    ),
                    1,
                ),
                else_=0,
            ),
            case(
                (
                    col(Video.release_date).is_not(None),
                    func.abs(
                        func.extract(
                            "epoch",
                            col(Video.release_date) - source_release,
                        )
                        / 86400.0,
                    ),
                ),
                else_=99999.0,
            ),
        )

    @staticmethod
    def _recommendation_overlap_predicate(
        catalog_ids: dict[str, list[int]],
        shared: dict[str, ScalarSelect[Any]],
    ) -> ColumnElement[bool] | None:
        """Require actress/series overlap, else genre/label/maker only."""

        clauses: list[ColumnElement[bool]] = []

        if catalog_ids["actress"]:
            clauses.append(shared["actress"] > 0)

        if catalog_ids["series"]:
            clauses.append(shared["series"] > 0)

        if not clauses:
            if catalog_ids["genre"]:
                clauses.append(shared["genre"] > 0)

            if catalog_ids["label"]:
                clauses.append(shared["label"] > 0)

            if catalog_ids["maker"]:
                clauses.append(shared["maker"] > 0)

        if not clauses:
            return None

        return or_(*clauses)

    def _recommendation_rank_score(
        self,
        catalog_ids: dict[str, list[int]],
        shared: dict[str, ScalarSelect[Any]],
        source_release: datetime | None,
    ) -> tuple[ColumnElement[Any], ColumnElement[Any]]:
        """Build rank score and release-delta expressions."""

        source_actress_count = len(catalog_ids["actress"])
        candidate_actress_count = (
            sa_select(func.count())
            .select_from(t_video_actress)
            .where(t_video_actress.c.video_id == col(Video.id))
            .correlate(Video)
            .scalar_subquery()
        )
        count_delta = func.abs(candidate_actress_count - source_actress_count)
        features_exact = case((count_delta == 0, 1), else_=0)
        release_in_window, release_delta_days = (
            self._release_window_expressions(source_release)
        )
        rank_score = (
            features_exact * 1_000_000
            + shared["series"] * 200_000
            + shared["actress"] * 100_000
            + release_in_window * 10_000
            - count_delta * 100
            + shared["genre"] * 10
            + shared["label"] * 3
            + shared["maker"]
        )

        return rank_score, release_delta_days

    async def compute_recommendation_candidates(
        self,
        video_id: int,
        *,
        limit: int = 50,
    ) -> list[tuple[int, float]]:
        """Compute ranked recommendation candidates for one video.

        Ranking priority (highest first):
        exact featured-actress count match, shared series, shared actress
        count, release date within ±6 months of the source, count proximity,
        shared genres, labels, makers.

        Candidates must share at least one actress or the same series (when
        the source has those links). Genre/label/maker-only overlap is used
        only when the source has no actresses and no series.

        Args:
            video_id: Source ``Video.id`` primary key.
            limit: Maximum candidates to return (clamped to 1–50).

        Returns:
            Ordered ``(recommended_video_id, score)`` pairs.
        """

        safe_limit = max(1, min(limit, 50))
        source_row = (
            await self.session.exec(
                select(Video.release_date).where(col(Video.id) == video_id),
            )
        ).first()
        source_release: datetime | None = (
            source_row if isinstance(source_row, datetime) else None
        )
        catalog_ids = await self._source_catalog_ids(video_id)

        if not any(catalog_ids.values()):
            return []

        shared = self._recommendation_shared_counts(catalog_ids)
        overlap_predicate = self._recommendation_overlap_predicate(
            catalog_ids,
            shared,
        )

        if overlap_predicate is None:
            return []

        rank_score, release_delta_days = self._recommendation_rank_score(
            catalog_ids,
            shared,
            source_release,
        )
        statement = (
            select(col(Video.id), rank_score)
            .where(
                col(Video.id) != video_id,
                overlap_predicate,
            )
            .order_by(
                rank_score.desc(),
                release_delta_days.asc(),
                col(Video.id).desc(),
            )
            .limit(safe_limit)
        )
        result = await self.session.exec(statement)

        return [(int(row[0]), float(row[1])) for row in result.all()]

    async def replace_recommendations_for_video(
        self,
        video_id: int,
        *,
        limit: int = 50,
    ) -> int:
        """Recompute and persist recommendations for one video.

        Deletes existing ``video_recommendation`` rows for ``video_id`` and
        inserts the newly ranked candidates.

        Args:
            video_id: Source ``Video.id`` primary key.
            limit: Max candidates to store (clamped to 1–50).

        Returns:
            Number of recommendation rows written.
        """

        candidates = await self.compute_recommendation_candidates(
            video_id,
            limit=limit,
        )

        await self.session.execute(
            delete(VideoRecommendation).where(
                col(VideoRecommendation.video_id) == video_id,
            ),
        )

        for rank, (recommended_id, score) in enumerate(candidates, start=1):
            self.session.add(
                VideoRecommendation(
                    video_id=video_id,
                    recommended_video_id=recommended_id,
                    rank=rank,
                    score=score,
                ),
            )

        await self.session.commit()

        return len(candidates)

    async def list_video_ids_missing_recommendations(self) -> list[int]:
        """Return video ids that have no pre-computed recommendation rows."""

        has_rows = (
            sa_select(col(VideoRecommendation.video_id))
            .where(col(VideoRecommendation.video_id) == col(Video.id))
            .exists()
        )
        statement = (
            select(col(Video.id))
            .where(~has_rows)
            .order_by(col(Video.id).asc())
        )
        rows = (await self.session.exec(statement)).all()

        return [int(row) for row in rows]

    async def list_video_ids_created_since(
        self,
        since: datetime,
    ) -> list[int]:
        """Return video ids with ``created_at`` strictly after ``since``."""

        statement = (
            select(col(Video.id))
            .where(col(Video.created_at) > since)
            .order_by(col(Video.id).asc())
        )
        rows = (await self.session.exec(statement)).all()

        return [int(row) for row in rows]

    async def list_related_recommendation_source_ids(
        self,
        video_id: int,
    ) -> list[int]:
        """Return other video ids that share actresses or series with ``video_id``.

        Used after inserting a new video so existing sources can rank it into
        their recommendation lists.
        """

        actress_ids = await self.association_fk_ids(t_video_actress, video_id)
        series_ids = await self.association_fk_ids(t_video_series, video_id)
        related: set[int] = set()

        if actress_ids:
            actress_result = await self.session.execute(
                sa_select(t_video_actress.c.video_id)
                .where(
                    t_video_actress.c.fk_id.in_(actress_ids),
                    t_video_actress.c.video_id != video_id,
                )
                .distinct(),
            )
            related.update(int(row[0]) for row in actress_result.all())

        if series_ids:
            series_result = await self.session.execute(
                sa_select(t_video_series.c.video_id)
                .where(
                    t_video_series.c.fk_id.in_(series_ids),
                    t_video_series.c.video_id != video_id,
                )
                .distinct(),
            )
            related.update(int(row[0]) for row in series_result.all())

        return sorted(related)
