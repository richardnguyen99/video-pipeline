"""Video application service."""

# pylint: disable=too-many-locals

from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.exc import NoInspectionAvailable

from app.models.video import Video
from app.repositories.video import VideoRepository
from app.schemas.video import (
    CommentUserResponse,
    VideoAkaResponse,
    VideoCatalogEntityAkaResponse,
    VideoCatalogEntityResponse,
    VideoCommentResponse,
    VideoDetailResponse,
    VideoEngagementCounts,
    VideoImageUrlResponse,
    VideoListResponse,
    VideoResponse,
)
from app.schemas.video_filters import (
    VideoListFilters,
    VideoSort,
    parse_features_cnt,
)


class VideoService:
    """Business operations for video resources."""

    def __init__(
        self,
        repository: VideoRepository,
    ) -> None:
        """Create a video service.

        Args:
            repository: Video data-access collaborator.
        """

        self._repository = repository

    def _to_video_response(
        self,
        row: Video,
        counts: VideoEngagementCounts,
    ) -> VideoResponse:
        """Map a list row to ``VideoResponse`` with engagement counts.

        Builds scalars explicitly so Pydantic does not read ORM
        relationship attributes named ``views`` / ``comments``.
        """

        image_urls = self._loaded_collection(row, "video_image_url")

        return VideoResponse(
            id=row.id,
            video_id=row.video_id,
            title=row.title,
            cid=row.cid,
            duration=row.duration,
            release_date=row.release_date,
            jancode=row.jancode,
            maker_product=row.maker_product,
            floor_code=row.floor_code,
            created_at=row.created_at,
            updated_at=row.updated_at,
            views=counts.views,
            likes=counts.likes,
            dislikes=counts.dislikes,
            comments=counts.comments,
            video_image_url=[
                VideoImageUrlResponse(
                    id=int(getattr(item, "id")),
                    url=str(getattr(item, "url")),
                    type=getattr(item, "type", None),
                )
                for item in image_urls
            ],
        )

    @staticmethod
    def _map_comment_user(user: object) -> CommentUserResponse:
        """Map an ORM user to the comment author payload."""

        return CommentUserResponse(
            id=str(getattr(user, "id")),
            username=str(getattr(user, "username")),
            display_name=getattr(user, "display_name", None),
            avatar_url=getattr(user, "avatar_url", None),
        )

    def _map_comment_node(
        self,
        comment: object,
        *,
        replies: list[VideoCommentResponse] | None = None,
    ) -> VideoCommentResponse:
        """Map one ORM comment to the frontend ``VideoComment`` shape."""

        parent_id = getattr(comment, "parent_id", None)

        return VideoCommentResponse(
            id=str(getattr(comment, "id")),
            video_id=int(getattr(comment, "video_id")),
            user=self._map_comment_user(getattr(comment, "user")),
            content=str(getattr(comment, "content")),
            is_edited=bool(getattr(comment, "is_edited", False)),
            is_deleted=bool(getattr(comment, "is_deleted", False)),
            created_at=getattr(comment, "created_at"),
            updated_at=getattr(comment, "updated_at"),
            parent_id=str(parent_id) if parent_id is not None else None,
            likes=0,
            dislikes=0,
            viewer_vote=None,
            replies=list(replies or []),
        )

    def _build_comment_tree(
        self,
        comments: list[object],
    ) -> list[VideoCommentResponse]:
        """Nest replies under parents; top-level nodes have no parent."""

        nodes: dict[str, VideoCommentResponse] = {}
        children: dict[str | None, list[str]] = {}

        for comment in comments:
            node = self._map_comment_node(comment)
            nodes[node.id] = node
            parent_key = node.parent_id
            children.setdefault(parent_key, []).append(node.id)

        def attach(comment_id: str) -> VideoCommentResponse:
            node = nodes[comment_id]
            reply_ids = children.get(comment_id, [])
            node.replies = [attach(reply_id) for reply_id in reply_ids]

            return node

        roots = children.get(None, [])

        return [attach(root_id) for root_id in roots]

    @staticmethod
    def _loaded_collection(row: object, name: str) -> list[object]:
        """Return a relationship collection only if already eager-loaded.

        Accessing an unloaded async relationship raises ``MissingGreenlet``.
        Plain test doubles (e.g. ``SimpleNamespace``) are read via getattr.
        """

        try:
            state = sa_inspect(row)
        except NoInspectionAvailable:
            value = getattr(row, name, None)

            return list(value or [])

        if state is None or name in state.unloaded:
            return []

        value = getattr(row, name)

        return list(value or [])

    @staticmethod
    def _normalize_locale(locale: Optional[str]) -> str:
        """Normalize locale query to a lowercase language key."""

        if locale is None or locale.strip() == "":
            return "en-us"

        return locale.strip().lower()

    @staticmethod
    def _pick_aka_row(
        akas: list[object],
        locale_key: str,
    ) -> Optional[object]:
        """Pick the aka ORM row matching ``locale_key``, then ``en-us`` / ``en``."""

        if not akas:
            return None

        ordered_keys = [locale_key]

        for fallback in ("en-us", "en"):
            if fallback not in ordered_keys:
                ordered_keys.append(fallback)

        by_language: dict[str, object] = {}

        for aka in akas:
            language = (getattr(aka, "language", None) or "").strip().lower()

            if language == "":
                continue

            by_language.setdefault(language, aka)

        for key in ordered_keys:
            match = by_language.get(key)

            if match is None:
                continue

            translated = (
                getattr(match, "translated_name", None) or ""
            ).strip()

            if translated == "":
                continue

            return match

        return None

    @classmethod
    def _pick_catalog_aka(
        cls,
        akas: list[object],
        locale_key: str,
    ) -> Optional[VideoCatalogEntityAkaResponse]:
        """Pick the catalog aka matching ``locale_key``, then ``en-us`` / ``en``."""

        match = cls._pick_aka_row(akas, locale_key)

        if match is None:
            return None

        return VideoCatalogEntityAkaResponse(
            id=getattr(match, "id"),
            translated_name=(getattr(match, "translated_name") or "").strip(),
            language=getattr(match, "language"),
        )

    @classmethod
    def _pick_video_aka(
        cls,
        akas: list[object],
        locale_key: str,
    ) -> Optional[VideoAkaResponse]:
        """Pick the video title aka matching ``locale_key``, then ``en-us`` / ``en``."""

        match = cls._pick_aka_row(akas, locale_key)

        if match is None:
            return None

        return VideoAkaResponse(
            id=getattr(match, "id"),
            translated_name=(getattr(match, "translated_name") or "").strip(),
            language=getattr(match, "language"),
        )

    def _map_catalog_entity(
        self,
        entity: object,
        aka_attr: str,
        locale_key: str,
    ) -> VideoCatalogEntityResponse:
        """Map a catalog ORM row to the video detail entity payload."""

        akas = list(getattr(entity, aka_attr, None) or [])

        return VideoCatalogEntityResponse(
            id=getattr(entity, "id"),
            name=getattr(entity, "name"),
            ruby=getattr(entity, "ruby", None),
            dmm_id=getattr(entity, "dmm_id", None),
            aka=self._pick_catalog_aka(akas, locale_key),
        )

    def _map_catalog_entities(
        self,
        entities: list[object],
        aka_attr: str,
        locale_key: str,
    ) -> list[VideoCatalogEntityResponse]:
        """Map a catalog collection with locale-aware aka."""

        return [
            self._map_catalog_entity(entity, aka_attr, locale_key)
            for entity in entities
        ]

    async def _to_video_detail_response(
        self,
        row: Video,
        *,
        counts: VideoEngagementCounts,
        comments: list[object],
        m3u8_url: Optional[str],
        locale: Optional[str] = None,
    ) -> VideoDetailResponse:
        """Validate a detail row and attach engagement fields."""

        locale_key = self._normalize_locale(locale)

        # Avoid model_validate(row) so relationship attrs named like
        # engagement fields are never read.
        base = VideoDetailResponse.model_validate(
            {
                "id": row.id,
                "video_id": row.video_id,
                "title": row.title,
                "cid": row.cid,
                "duration": row.duration,
                "release_date": row.release_date,
                "jancode": row.jancode,
                "maker_product": row.maker_product,
                "floor_code": row.floor_code,
                "created_at": row.created_at,
                "updated_at": row.updated_at,
                "video_aka": self._pick_video_aka(
                    self._loaded_collection(row, "video_aka"),
                    locale_key,
                ),
                "actresses": row.actresses,
                "genres": self._map_catalog_entities(
                    list(row.genres or []),
                    "genre_aka",
                    locale_key,
                ),
                "series": self._map_catalog_entities(
                    list(row.series or []),
                    "series_aka",
                    locale_key,
                ),
                "makers": self._map_catalog_entities(
                    list(row.makers or []),
                    "maker_aka",
                    locale_key,
                ),
                "labels": self._map_catalog_entities(
                    list(row.labels or []),
                    "label_aka",
                    locale_key,
                ),
                "directors": self._map_catalog_entities(
                    list(row.directors or []),
                    "director_aka",
                    locale_key,
                ),
                "video_image_url": self._loaded_collection(
                    row,
                    "video_image_url",
                ),
                "video_sample_image_url": self._loaded_collection(
                    row,
                    "video_sample_image_url",
                ),
                "video_sample_movie_url": self._loaded_collection(
                    row,
                    "video_sample_movie_url",
                ),
                "m3u8_url": m3u8_url,
                "views": counts.views,
                "likes": counts.likes,
                "dislikes": counts.dislikes,
                "comments": self._build_comment_tree(comments),
            },
        )

        return base

    async def list_videos(
        self,
        *,
        limit: int = 20,
        offset: int = 0,
        page: Optional[int] = None,
        sort: Optional[VideoSort] = None,
        actress: Optional[list[int]] = None,
        genre: Optional[list[int]] = None,
        maker: Optional[int] = None,
        label: Optional[int] = None,
        director: Optional[int] = None,
        series: Optional[int] = None,
        features_cnt: Optional[str] = None,
        q: Optional[str] = None,
        locale: Optional[str] = None,
    ) -> VideoListResponse:
        """List videos with discover filters and pagination.

        Multi-value filters use OR semantics within each id list
        (``?actress=1&actress=2`` matches videos featuring either).

        Nested relations are omitted; use ``GET /videos/{id}`` for full
        payloads including media and catalog links.

        Args:
            limit: Page size (clamped to at least 1).
            offset: Rows to skip when ``page`` is not provided.
            page: 1-based page index; overrides ``offset`` when set.
            sort: Discover sort key.
            actress: Actress primary keys (repeated query keys).
            genre: Genre primary keys (repeated query keys).
            maker: Single maker id.
            label: Single label id.
            director: Single director id.
            series: Single series id.
            features_cnt: Raw range string (``2``, ``3,``, ``1,3``).
            q: Plus-/space-separated search terms (video + catalog).
            locale: Aka language for catalog match (default ``en-us``).

        Returns:
            A ``VideoListResponse`` with items and totals.

        Raises:
            HTTPException: 400 when ``features_cnt`` is invalid.
        """

        safe_limit = max(1, limit)
        features_range = None

        if features_cnt is not None and features_cnt.strip() != "":
            try:
                features_range = parse_features_cnt(features_cnt)
            except ValueError as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=str(exc),
                ) from exc

        filters = VideoListFilters(
            actress=list(actress or []),
            genre=list(genre or []),
            maker=maker,
            label=label,
            director=director,
            series=series,
            features_cnt=features_range,
            q=q,
            locale=(locale or "en-us").strip() or "en-us",
            sort=sort or VideoSort.TRENDING_WEEK,
        )

        if page is not None:
            safe_page = max(1, page)
            safe_offset = (safe_page - 1) * safe_limit
        else:
            safe_offset = max(0, offset)

        rows, total = await self._repository.list_and_count_videos(
            filters=filters,
            limit=safe_limit,
            offset=safe_offset,
        )
        engagement = await self._repository.count_engagement_for_videos(
            [row.id for row in rows],
        )
        empty_counts = VideoEngagementCounts()
        items = [
            self._to_video_response(
                row,
                engagement.get(row.id, empty_counts),
            )
            for row in rows
        ]

        return VideoListResponse(
            items=items,
            total=total,
            limit=safe_limit,
            offset=safe_offset,
        )

    async def get_video(
        self,
        video_id: int,
        *,
        locale: Optional[str] = None,
    ) -> VideoDetailResponse:
        """Return a single video by primary key with full relations.

        Media and ``m3u8_url`` values are returned as stored in the database.
        Catalog entities (genre, series, maker, label, director) include a
        locale-matched ``aka`` when available.

        Args:
            video_id: ``Video.id`` primary key.
            locale: Preferred aka language (default ``en-us``).

        Returns:
            A ``VideoDetailResponse`` including actress aka and images.

        Raises:
            HTTPException: When no video exists for ``video_id``.
        """

        row = await self._repository.get_by_id(video_id)

        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Video not found",
            )

        engagement = await self._repository.count_engagement_for_videos(
            [row.id],
        )
        counts = engagement.get(row.id, VideoEngagementCounts())
        comments = await self._repository.list_comments_for_video(row.id)
        master_m3u8 = await self._repository.get_master_m3u8_url(row.id)

        return await self._to_video_detail_response(
            row,
            counts=counts,
            comments=list(comments),
            m3u8_url=master_m3u8,
            locale=locale,
        )
