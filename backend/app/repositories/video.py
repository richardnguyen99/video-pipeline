"""Video data-access repository."""

import asyncio
from typing import Any, Optional, Type, cast

from sqlalchemy import Table, and_, func, or_
from sqlalchemy import select as sa_select
from sqlalchemy.orm import selectinload
from sqlalchemy.sql import ColumnElement
from sqlmodel import col, select

from app.models.actress import Actress, ActressAka
from app.models.base import AkaMixin, DmmCatalogMixin
from app.models.comments import Comment
from app.models.director import Director, DirectorAka
from app.models.genre import Genre, GenreAka
from app.models.label import Label, LabelAka
from app.models.maker import Maker, MakerAka
from app.models.series import Series, SeriesAka
from app.models.video import (
    Video,
    VideoImageUrl,
    VideoM3u8,
)
from app.models.video_reaction import VideoReaction
from app.models.video_view import VideoView
from app.repositories.base import BaseRepository
from app.repositories.video_recommendations import VideoRecommendationMixin
from app.schemas.video import VideoEngagementCounts
from app.schemas.video_filters import VideoListFilters
from app.utils import relationship_attr
from app.utils.common import media_load, search_terms
from app.utils.video import (
    DETAIL_OPTIONS,
    apply_filters,
    apply_search_with_catalog_ids,
    apply_sort,
)


class VideoRepository(VideoRecommendationMixin, BaseRepository):
    """Read operations for ``Video`` rows."""

    @staticmethod
    def _catalog_ilike_predicates(
        entity: Type[DmmCatalogMixin],
        aka_model: Type[AkaMixin],
        terms: list[str],
    ) -> list[ColumnElement[bool]]:
        """Build ILIKE predicates for catalog name, ruby, and aka fields."""

        patterns = [f"%{term}%" for term in terms]

        return [
            *[col(entity.name).ilike(pattern) for pattern in patterns],
            *[col(entity.ruby).ilike(pattern) for pattern in patterns],
            *[
                col(aka_model.translated_name).ilike(pattern)
                for pattern in patterns
            ],
        ]

    @staticmethod
    def _assign_catalog_ids_to_terms(
        terms: list[str],
        rows: list[Any],
    ) -> list[list[int]]:
        """Map joined catalog rows onto each search term's matching ids."""

        per_term: list[list[int]] = [[] for _ in terms]
        seen: list[set[int]] = [set() for _ in terms]

        for row in rows:
            entity_id = int(row[0])
            haystacks = (
                (row[1] or "").lower(),
                (row[2] or "").lower(),
                (row[3] or "").lower(),
            )

            for term_index, term in enumerate(terms):
                needle = term.lower()

                if (
                    any(needle in value for value in haystacks)
                    and entity_id not in seen[term_index]
                ):
                    seen[term_index].add(entity_id)
                    per_term[term_index].append(entity_id)

        return per_term

    async def _resolve_one_catalog(
        self,
        key: str,
        entity: Type[DmmCatalogMixin],
        aka_model: Type[AkaMixin],
        terms: list[str],
        locale_key: str,
    ) -> tuple[str, list[list[int]]]:
        """Resolve catalog ids for all terms in one joined query."""

        statement = (
            sa_select(
                col(entity.id),
                col(entity.name),
                col(entity.ruby),
                col(aka_model.translated_name),
            )
            .select_from(entity)
            .outerjoin(
                aka_model,
                and_(
                    col(aka_model.fk_id) == col(entity.id),
                    col(aka_model.language) == locale_key,
                ),
            )
            .where(
                or_(
                    *self._catalog_ilike_predicates(entity, aka_model, terms),
                ),
            )
        )
        rows = list((await self.session.execute(statement)).all())

        return key, self._assign_catalog_ids_to_terms(terms, rows)

    async def _resolve_actress_ids_for_terms(
        self,
        terms: list[str],
    ) -> list[list[int]]:
        """Resolve actress ids matching name, ruby, or aka translated_name."""

        patterns = [f"%{term}%" for term in terms]
        name_preds = [col(Actress.name).ilike(p) for p in patterns]
        ruby_preds = [col(Actress.ruby).ilike(p) for p in patterns]
        aka_preds = [
            col(ActressAka.translated_name).ilike(p) for p in patterns
        ]
        aka_name_preds = [col(ActressAka.name).ilike(p) for p in patterns]

        statement = (
            sa_select(
                col(Actress.id),
                col(Actress.name),
                col(Actress.ruby),
                col(ActressAka.name),
                col(ActressAka.translated_name),
            )
            .select_from(Actress)
            .outerjoin(
                ActressAka,
                col(ActressAka.fk_id) == col(Actress.id),
            )
            .where(
                or_(
                    *name_preds,
                    *ruby_preds,
                    *aka_preds,
                    *aka_name_preds,
                ),
            )
        )
        rows = (await self.session.execute(statement)).all()

        per_term: list[list[int]] = [[] for _ in terms]
        seen: list[set[int]] = [set() for _ in terms]

        for row in rows:
            actress_id = int(row[0])
            haystacks = [
                (row[1] or "").lower(),
                (row[2] or "").lower(),
                (row[3] or "").lower(),
                (row[4] or "").lower(),
            ]

            for term_index, term in enumerate(terms):
                needle = term.lower()

                if (
                    any(needle in h for h in haystacks)
                    and actress_id not in seen[term_index]
                ):
                    seen[term_index].add(actress_id)
                    per_term[term_index].append(actress_id)

        return per_term

    async def _resolve_catalog_ids_for_terms(
        self,
        terms: list[str],
        locale: Optional[str],
    ) -> list[dict[str, list[int]]]:
        """Resolve catalog entity ids for each search term (parallel).

        Returns one dict per term with keys expected by
        ``apply_search_with_catalog_ids`` (``actress``, ``genre``, …).
        """

        if not terms:
            return []

        locale_key = (locale or "en-us").lower()
        catalog_specs: list[
            tuple[str, Type[DmmCatalogMixin], Type[AkaMixin]]
        ] = [
            ("maker", Maker, MakerAka),
            ("genre", Genre, GenreAka),
            ("series", Series, SeriesAka),
            ("label", Label, LabelAka),
            ("director", Director, DirectorAka),
        ]

        actress_task = self._resolve_actress_ids_for_terms(terms)
        catalog_tasks = [
            self._resolve_one_catalog(
                key,
                entity,
                aka_model,
                terms,
                locale_key,
            )
            for key, entity, aka_model in catalog_specs
        ]
        gather_result = await asyncio.gather(
            actress_task,
            *catalog_tasks,
        )
        actress_result = cast(list[list[int]], gather_result[0])
        catalog_results = cast(
            list[tuple[str, list[list[int]]]],
            list(gather_result[1:]),
        )

        by_entity: dict[str, list[list[int]]] = {
            "actress": actress_result,
        }

        for key, per_term in catalog_results:
            by_entity[key] = per_term

        catalog_by_term: list[dict[str, list[int]]] = []

        for term_index in range(len(terms)):
            term_ids: dict[str, list[int]] = {
                entity_key: entity_values[term_index]
                for entity_key, entity_values in by_entity.items()
            }
            catalog_by_term.append(term_ids)

        return catalog_by_term

    async def list_and_count_videos(
        self,
        filters: VideoListFilters,
        *,
        limit: Optional[int] = None,
        offset: int = 0,
    ) -> tuple[list[Video], int]:
        """Return filtered videos and the matching total count."""

        terms = search_terms(filters.q or "")
        catalog_by_term = (
            await self._resolve_catalog_ids_for_terms(terms, filters.locale)
            if terms
            else []
        )

        statement = select(Video).options(*DETAIL_OPTIONS)
        statement = apply_filters(statement, filters)
        statement = apply_search_with_catalog_ids(
            statement,
            filters,
            catalog_by_term,
        )
        statement = apply_sort(statement, filters.sort)

        count_statement = select(func.count()).select_from(Video)
        count_statement = apply_filters(count_statement, filters)
        count_statement = apply_search_with_catalog_ids(
            count_statement,
            filters,
            catalog_by_term,
        )

        if limit is not None:
            statement = statement.limit(limit)

        if offset:
            statement = statement.offset(offset)

        rows_result, total_result = await asyncio.gather(
            self.session.exec(statement),
            self.session.exec(count_statement),
        )

        return list(rows_result.all()), int(total_result.one())

    async def list_videos_by_ids(
        self,
        video_ids: list[int],
        *,
        preserve_order: bool = True,
    ) -> list[Video]:
        """Load videos by primary key, optionally preserving input order."""

        if not video_ids:
            return []

        statement = (
            select(Video)
            .where(col(Video.id).in_(video_ids))
            .options(*DETAIL_OPTIONS)
        )
        rows = list((await self.session.exec(statement)).all())

        if not preserve_order:
            return rows

        by_id = {video.id: video for video in rows}

        return [by_id[video_id] for video_id in video_ids if video_id in by_id]

    async def list_videos(
        self,
        filters: VideoListFilters,
        *,
        limit: Optional[int] = None,
        offset: int = 0,
    ) -> list[Video]:
        """Return filtered video rows."""

        terms = search_terms(filters.q or "")
        catalog_by_term = (
            await self._resolve_catalog_ids_for_terms(terms, filters.locale)
            if terms
            else []
        )
        statement = select(Video).options(*DETAIL_OPTIONS)
        statement = apply_filters(statement, filters)
        statement = apply_search_with_catalog_ids(
            statement,
            filters,
            catalog_by_term,
        )
        statement = apply_sort(statement, filters.sort)

        if limit is not None:
            statement = statement.limit(limit)

        if offset:
            statement = statement.offset(offset)

        result = await self.session.exec(statement)

        return list(result.all())

    async def count_videos(
        self,
        filters: VideoListFilters,
    ) -> int:
        """Return the number of videos matching filters."""

        terms = search_terms(filters.q or "")
        catalog_by_term = (
            await self._resolve_catalog_ids_for_terms(terms, filters.locale)
            if terms
            else []
        )
        statement = select(func.count()).select_from(Video)
        statement = apply_filters(statement, filters)
        statement = apply_search_with_catalog_ids(
            statement,
            filters,
            catalog_by_term,
        )
        result = await self.session.exec(statement)

        return int(result.one())

    async def get_by_id(self, video_id: int) -> Optional[Video]:
        """Return one video with detail relationships loaded."""

        statement = (
            select(Video)
            .where(col(Video.id) == video_id)
            .options(*DETAIL_OPTIONS)
        )
        result = await self.session.exec(statement)

        return result.first()

    async def get_by_ids(self, video_ids: list[int]) -> list[Video]:
        """Return videos for the given primary keys."""

        if not video_ids:
            return []

        statement = (
            select(Video)
            .where(col(Video.id).in_(video_ids))
            .options(*DETAIL_OPTIONS)
        )
        result = await self.session.exec(statement)

        return list(result.all())

    async def list_public_by_uploader(
        self,
        uploader_id: Any,
        *,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[Video], int]:
        """Return public uploads for an uploader and the total count."""

        filters = [
            col(Video.uploader_id) == uploader_id,
            col(Video.visibility) == "public",
            col(Video.origin) == "upload",
        ]
        statement = (
            select(Video)
            .where(*filters)
            .options(
                media_load(
                    Video.video_image_url,
                    VideoImageUrl.id,
                    VideoImageUrl.url,
                    VideoImageUrl.type,
                ),
            )
            .order_by(col(Video.created_at).desc())
            .offset(offset)
            .limit(limit)
        )
        count_statement = (
            select(func.count()).select_from(Video).where(*filters)
        )
        rows_result, total_result = await asyncio.gather(
            self.session.exec(statement),
            self.session.exec(count_statement),
        )

        return list(rows_result.all()), int(total_result.one())

    async def exists_by_id(self, video_id: int) -> bool:
        """Return whether a video primary key exists."""

        statement = select(col(Video.id)).where(col(Video.id) == video_id)
        result = await self.session.exec(statement)

        return result.first() is not None

    async def association_fk_ids(
        self,
        table: Table,
        video_id: int,
    ) -> list[int]:
        """Return association ``fk_id`` values linked to ``video_id``."""

        statement = select(table.c.fk_id).where(table.c.video_id == video_id)
        rows = (await self.session.exec(statement)).all()

        return [int(row) for row in rows]

    async def count_engagement_for_videos(
        self,
        video_ids: list[int],
    ) -> dict[int, VideoEngagementCounts]:
        """Return views/likes/dislikes/comments counts for many videos.

        Runs four grouped ``COUNT`` queries. Missing ids default to zero
        counts (no seed data required).

        Args:
            video_ids: Primary keys to aggregate.

        Returns:
            Mapping of video id → engagement totals.
        """

        if not video_ids:
            return {}

        unique_ids = list(dict.fromkeys(video_ids))
        totals: dict[int, dict[str, int]] = {
            video_id: {
                "views": 0,
                "likes": 0,
                "dislikes": 0,
                "comments": 0,
            }
            for video_id in unique_ids
        }

        # Countable views are append-only ``VideoView`` rows (one per eligible
        # session). ``UserWatchHistory.total_view_count`` is a denormalized
        # per-user counter and cannot date individual views.
        view_statement = (
            select(
                col(VideoView.video_id),
                func.count(),
            )
            .where(col(VideoView.video_id).in_(unique_ids))
            .group_by(col(VideoView.video_id))
        )
        view_result = await self.session.exec(view_statement)

        for video_id, total in view_result.all():
            totals[int(video_id)]["views"] = int(total)

        reaction_statement = (
            select(
                col(VideoReaction.video_id),
                func.count()
                .filter(col(VideoReaction.is_like).is_(True))
                .label("likes"),
                func.count()
                .filter(col(VideoReaction.is_like).is_(False))
                .label("dislikes"),
            )
            .where(col(VideoReaction.video_id).in_(unique_ids))
            .group_by(col(VideoReaction.video_id))
        )
        reaction_result = await self.session.exec(reaction_statement)

        for video_id, likes, dislikes in reaction_result.all():
            totals[int(video_id)]["likes"] = int(likes)
            totals[int(video_id)]["dislikes"] = int(dislikes)

        comment_statement = (
            select(col(Comment.video_id), func.count())
            .where(
                col(Comment.video_id).in_(unique_ids),
                col(Comment.is_deleted).is_(False),
            )
            .group_by(col(Comment.video_id))
        )
        comment_result = await self.session.exec(comment_statement)

        for video_id, total in comment_result.all():
            totals[int(video_id)]["comments"] = int(total)

        return {
            video_id: VideoEngagementCounts(**counts)
            for video_id, counts in totals.items()
        }

    async def list_comments_for_video(
        self,
        video_id: int,
    ) -> list[Comment]:
        """Return comments for a video with authors loaded.

        Soft-deleted comments are included so reply threads keep structure;
        the API maps deleted bodies to empty strings.
        """

        statement = (
            select(Comment)
            .where(
                col(Comment.video_id) == video_id,
            )
            .options(selectinload(relationship_attr(Comment.user)))
            .order_by(col(Comment.created_at).asc())
        )
        result = await self.session.exec(statement)

        return list(result.all())

    async def get_master_m3u8_url(self, video_id: int) -> Optional[str]:
        """Return the master playlist URL for a video, if any."""

        statement = select(VideoM3u8).where(col(VideoM3u8.fk_id) == video_id)
        result = await self.session.exec(statement)
        row = result.first()

        if row is None:
            return None

        return str(row.m3u8_url)
