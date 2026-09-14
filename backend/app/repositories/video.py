"""Video data-access repository."""

# pylint: disable=too-many-locals,too-many-positional-arguments

import asyncio
from typing import Any, Optional, Type

from sqlalchemy import and_, func, or_
from sqlalchemy import select as sa_select
from sqlalchemy.orm import selectinload
from sqlmodel import col, select

from app.models.actress import Actress, ActressAka
from app.models.associations import (
    t_video_actress,
    t_video_genre,
    t_video_label,
    t_video_maker,
    t_video_series,
)
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


class VideoRepository(BaseRepository):
    """Read operations for ``Video`` rows."""

    async def _resolve_one_catalog(
        self,
        key: str,
        entity: Type[DmmCatalogMixin],
        aka_model: Type[AkaMixin],
        terms: list[str],
        locale_key: str,
    ) -> tuple[str, list[list[int]]]:
        """Resolve catalog ids for all terms in one joined query."""

        patterns = [f"%{term}%" for term in terms]
        name_preds = [col(entity.name).ilike(p) for p in patterns]
        ruby_preds = [col(entity.ruby).ilike(p) for p in patterns]
        aka_preds = [col(aka_model.translated_name).ilike(p) for p in patterns]

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
                    *name_preds,
                    *ruby_preds,
                    *aka_preds,
                ),
            )
        )
        rows = (await self.session.execute(statement)).all()

        per_term: list[list[int]] = [[] for _ in terms]
        seen: list[set[int]] = [set() for _ in terms]

        for row in rows:
            entity_id = int(row[0])
            name = (row[1] or "").lower()
            ruby = (row[2] or "").lower()
            translated = (row[3] or "").lower()

            for term_index, term in enumerate(terms):
                needle = term.lower()

                if (
                    needle in name or needle in ruby or needle in translated
                ) and entity_id not in seen[term_index]:
                    seen[term_index].add(entity_id)
                    per_term[term_index].append(entity_id)

        return key, per_term

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
        locale: str,
    ) -> list[dict[str, list[int]]]:
        """Resolve matching catalog/actress primary keys per search term.

        Runs one joined query per catalog type (and actresses) in parallel.
        """

        if not terms:
            return []

        locale_key = locale.strip().lower() or "en-us"
        catalog_specs: list[
            tuple[str, Type[DmmCatalogMixin], Type[AkaMixin]]
        ] = [
            ("genre", Genre, GenreAka),
            ("maker", Maker, MakerAka),
            ("label", Label, LabelAka),
            ("series", Series, SeriesAka),
            ("director", Director, DirectorAka),
        ]

        catalog_task = asyncio.gather(
            *[
                self._resolve_one_catalog(
                    key,
                    entity,
                    aka_model,
                    terms,
                    locale_key,
                )
                for key, entity, aka_model in catalog_specs
            ],
        )
        actress_task = self._resolve_actress_ids_for_terms(terms)
        resolved, actress_per_term = await asyncio.gather(
            catalog_task,
            actress_task,
        )

        result: list[dict[str, list[int]]] = [
            {
                "actress": [],
                "genre": [],
                "maker": [],
                "label": [],
                "series": [],
                "director": [],
            }
            for _ in terms
        ]

        for key, per_term in resolved:
            for term_index, ids in enumerate(per_term):
                result[term_index][key] = ids

        for term_index, ids in enumerate(actress_per_term):
            result[term_index]["actress"] = ids

        return result

    async def list_and_count_videos(
        self,
        *,
        filters: Optional[VideoListFilters] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[Video], int]:
        """Return a page of videos and total count with shared search work."""

        resolved = filters or VideoListFilters()
        catalog_by_term: list[dict[str, list[int]]] | None = None

        if resolved.q and resolved.q.strip():
            terms = search_terms(resolved.q)
            catalog_by_term = await self._resolve_catalog_ids_for_terms(
                terms,
                resolved.locale,
            )

        def _with_search(stmt: Any) -> Any:
            stmt = apply_filters(stmt, resolved)

            if catalog_by_term is not None:
                stmt = apply_search_with_catalog_ids(
                    stmt,
                    resolved,
                    catalog_by_term,
                )

            return stmt

        count_statement = _with_search(
            select(func.count()).select_from(Video),
        )
        total = int((await self.session.exec(count_statement)).one())

        page_statement = apply_sort(
            _with_search(select(Video)),
            resolved.sort,
            resolved,
        )
        page_statement = page_statement.options(
            media_load(
                Video.video_image_url,
                VideoImageUrl.id,
                VideoImageUrl.url,
                VideoImageUrl.type,
            ),
        )
        page_statement = page_statement.offset(offset).limit(limit)
        rows = list((await self.session.exec(page_statement)).all())

        return rows, total

    async def list_videos(
        self,
        *,
        filters: Optional[VideoListFilters] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[Video]:
        """Return a page of videos with filters and sort (no relations).

        Args:
            filters: Optional discover filters and sort.
            limit: Maximum rows to return.
            offset: Number of rows to skip.

        Returns:
            Matching ``Video`` instances without nested collections.
        """

        resolved = filters or VideoListFilters()
        statement = select(Video)
        statement = apply_filters(statement, resolved)

        if resolved.q and resolved.q.strip():
            terms = search_terms(resolved.q)
            catalog_by_term = await self._resolve_catalog_ids_for_terms(
                terms,
                resolved.locale,
            )
            statement = apply_search_with_catalog_ids(
                statement,
                resolved,
                catalog_by_term,
            )

        statement = apply_sort(statement, resolved.sort, resolved)
        statement = statement.options(
            media_load(
                Video.video_image_url,
                VideoImageUrl.id,
                VideoImageUrl.url,
                VideoImageUrl.type,
            ),
        )
        statement = statement.offset(offset).limit(limit)
        result = await self.session.exec(statement)

        return list(result.all())

    async def count_videos(
        self,
        *,
        filters: Optional[VideoListFilters] = None,
    ) -> int:
        """Return the number of videos matching optional filters."""

        resolved = filters or VideoListFilters()
        statement = select(func.count()).select_from(Video)
        statement = apply_filters(statement, resolved)

        if resolved.q and resolved.q.strip():
            terms = search_terms(resolved.q)
            catalog_by_term = await self._resolve_catalog_ids_for_terms(
                terms,
                resolved.locale,
            )
            statement = apply_search_with_catalog_ids(
                statement,
                resolved,
                catalog_by_term,
            )

        result = await self.session.exec(statement)
        total = result.one()

        return int(total)

    async def get_by_id(self, video_id: int) -> Optional[Video]:
        """Return one video by primary key with full relation graph.

        Args:
            video_id: ``Video.id`` primary key (not the string code).

        Returns:
            The ``Video`` row or ``None`` when missing.
        """

        statement = (
            select(Video)
            .where(col(Video.id) == video_id)
            .options(*DETAIL_OPTIONS)
        )
        result = await self.session.exec(statement)

        return result.first()

    async def exists_by_id(self, video_id: int) -> bool:
        """Return whether a video primary key exists."""

        statement = select(col(Video.id)).where(col(Video.id) == video_id)
        result = await self.session.exec(statement)

        return result.first() is not None

    async def list_recommended_for_video(
        self,
        video_id: int,
        *,
        limit: int = 12,
    ) -> list[Video]:
        """Return videos ranked by similarity to ``video_id``.

        Ranking priority (highest first):
        shared actresses, featured-actress-count proximity, shared genres,
        shared series, shared labels, shared makers.

        Args:
            video_id: Source ``Video.id`` primary key.
            limit: Maximum number of recommendations to return.

        Returns:
            Ordered ``Video`` rows with ``video_image_url`` loaded.
        """

        safe_limit = max(1, min(limit, 50))

        async def _ids(table: Any) -> list[int]:
            statement = select(table.c.fk_id).where(
                table.c.video_id == video_id
            )
            rows = (await self.session.exec(statement)).all()

            return [int(row) for row in rows]

        actress_ids = await _ids(t_video_actress)
        genre_ids = await _ids(t_video_genre)
        series_ids = await _ids(t_video_series)
        label_ids = await _ids(t_video_label)
        maker_ids = await _ids(t_video_maker)
        source_actress_count = len(actress_ids)

        if not any((actress_ids, genre_ids, series_ids, label_ids, maker_ids)):
            return []

        def _shared_count(table: Any, seed_ids: list[int]) -> Any:
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

        shared_actress = _shared_count(t_video_actress, actress_ids)
        shared_genre = _shared_count(t_video_genre, genre_ids)
        shared_series = _shared_count(t_video_series, series_ids)
        shared_label = _shared_count(t_video_label, label_ids)
        shared_maker = _shared_count(t_video_maker, maker_ids)

        candidate_actress_count = (
            sa_select(func.count())
            .select_from(t_video_actress)
            .where(t_video_actress.c.video_id == col(Video.id))
            .correlate(Video)
            .scalar_subquery()
        )
        features_proximity = -func.abs(
            candidate_actress_count - source_actress_count,
        )

        overlap_predicate = or_(
            shared_actress > 0,
            shared_genre > 0,
            shared_series > 0,
            shared_label > 0,
            shared_maker > 0,
        )

        statement = (
            select(Video)
            .where(
                col(Video.id) != video_id,
                overlap_predicate,
            )
            .order_by(
                shared_actress.desc(),
                features_proximity.desc(),
                shared_genre.desc(),
                shared_series.desc(),
                shared_label.desc(),
                shared_maker.desc(),
                col(Video.id).desc(),
            )
            .options(
                media_load(
                    Video.video_image_url,
                    VideoImageUrl.id,
                    VideoImageUrl.url,
                    VideoImageUrl.type,
                ),
            )
            .limit(safe_limit)
        )
        result = await self.session.exec(statement)

        return list(result.all())

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

        view_statement = (
            select(col(VideoView.video_id), func.count())
            .where(col(VideoView.video_id).in_(unique_ids))
            .group_by(col(VideoView.video_id))
        )
        view_result = await self.session.exec(view_statement)

        for video_id, total in view_result.all():
            totals[int(video_id)]["views"] = int(total)

        like_statement = (
            select(col(VideoReaction.video_id), func.count())
            .where(
                col(VideoReaction.video_id).in_(unique_ids),
                col(VideoReaction.is_like).is_(True),
            )
            .group_by(col(VideoReaction.video_id))
        )
        like_result = await self.session.exec(like_statement)

        for video_id, total in like_result.all():
            totals[int(video_id)]["likes"] = int(total)

        dislike_statement = (
            select(col(VideoReaction.video_id), func.count())
            .where(
                col(VideoReaction.video_id).in_(unique_ids),
                col(VideoReaction.is_like).is_(False),
            )
            .group_by(col(VideoReaction.video_id))
        )
        dislike_result = await self.session.exec(dislike_statement)

        for video_id, total in dislike_result.all():
            totals[int(video_id)]["dislikes"] = int(total)

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
            video_id: VideoEngagementCounts(**values)
            for video_id, values in totals.items()
        }

    async def list_comments_for_video(
        self,
        video_id: int,
    ) -> list[Comment]:
        """Return non-deleted comments for a video with authors loaded.

        Args:
            video_id: ``Video.id`` primary key.

        Returns:
            Comments ordered by creation time ascending.
        """

        statement = (
            select(Comment)
            .where(
                col(Comment.video_id) == video_id,
                col(Comment.is_deleted).is_(False),
            )
            .options(selectinload(relationship_attr(Comment.user)))
            .order_by(col(Comment.created_at).asc())
        )
        result = await self.session.exec(statement)

        return list(result.all())

    async def get_master_m3u8_url(self, video_id: int) -> Optional[str]:
        """Return the master HLS playlist path for a video, if any.

        Prefers an ``index.m3u8`` entry when several rows exist; otherwise
        the earliest ``VideoM3u8`` row by primary key.

        Args:
            video_id: ``Video.id`` primary key (``video_m3u8.fk_id``).

        Returns:
            Local or remote master playlist URL, or ``None``.
        """

        statement = (
            select(VideoM3u8)
            .where(col(VideoM3u8.fk_id) == video_id)
            .order_by(col(VideoM3u8.id).asc())
        )
        result = await self.session.exec(statement)
        rows = list(result.all())

        if not rows:
            return None

        for row in rows:
            url = (row.m3u8_url or "").rstrip("/")

            if url.endswith("index.m3u8"):
                return row.m3u8_url

        return rows[0].m3u8_url
