"""Video application service."""

# pylint: disable=too-many-locals

from typing import Any, Optional

from fastapi import HTTPException, status
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.exc import NoInspectionAvailable

from app.models.video import Video
from app.repositories.video import VideoRepository
from app.schemas.video import (
    CommentUserResponse,
    VideoCommentResponse,
    VideoDetailResponse,
    VideoEngagementCounts,
    VideoListResponse,
    VideoResponse,
)
from app.schemas.video_filters import (
    VideoListFilters,
    VideoSort,
    parse_features_cnt,
)
from app.storage.client import ObjectStorageClient


class VideoService:
    """Business operations for video resources."""

    def __init__(
        self,
        repository: VideoRepository,
        storage: ObjectStorageClient,
    ) -> None:
        """Create a video service.

        Args:
            repository: Video data-access collaborator.
            storage: Object storage used to resolve local media URLs.
        """

        self._repository = repository
        self._storage = storage

    @staticmethod
    def _is_remote_url(url: str) -> bool:
        """Return True when ``url`` is already an http(s) link."""

        return url.startswith("http://") or url.startswith("https://")

    async def _resolve_local_media_url(self, url: str) -> str:
        """Map a local disk path to a public MinIO object URL.

        Uploads the file into the bucket on first access when it is missing.
        Applies to ``sample_gen`` stills and local review clips
        (``video_sample_movie_url``).
        """

        if self._is_remote_url(url):
            return url

        try:
            return await self._storage.ensure_local_media_public_url(url)
        except FileNotFoundError:
            key = self._storage.object_key_from_local_path(url)

            return self._storage.public_url(key)

    async def _rewrite_media_urls(
        self,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        """Rewrite local paths in sample image/movie lists."""

        for field in ("video_sample_image_url", "video_sample_movie_url"):
            items = payload.get(field) or []

            for item in items:
                raw_url = item.get("url")

                if not raw_url:
                    continue

                item["url"] = await self._resolve_local_media_url(raw_url)

        return payload

    def _to_video_response(
        self,
        row: Video,
        counts: VideoEngagementCounts,
    ) -> VideoResponse:
        """Map a list row to ``VideoResponse`` with engagement counts.

        Builds scalars explicitly so Pydantic does not read ORM
        relationship attributes named ``views`` / ``comments``.
        """

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

    async def _resolve_master_m3u8_url(
        self,
        raw_url: Optional[str],
    ) -> Optional[str]:
        """Resolve a master playlist path to a client-facing URL.

        For local packages, uploads the full HLS tree (master + quality
        playlists + ``.ts`` segments) so relative URLs in the master
        resolve under the same public prefix. Remote http(s) URLs are
        returned unchanged.
        """

        if not raw_url:
            return None

        if self._is_remote_url(raw_url):
            return raw_url

        try:
            return await self._storage.ensure_hls_tree_public_url(raw_url)
        except FileNotFoundError:
            key = self._storage.object_key_from_local_path(raw_url)

            return self._storage.public_url(key)

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

    async def _to_video_detail_response(
        self,
        row: Video,
        *,
        counts: VideoEngagementCounts,
        comments: list[object],
        m3u8_url: Optional[str],
    ) -> VideoDetailResponse:
        """Validate a detail row, rewrite media URLs, attach engagement."""

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
                "actresses": row.actresses,
                "genres": row.genres,
                "series": row.series,
                "makers": row.makers,
                "labels": row.labels,
                "directors": row.directors,
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
                "m3u8_url": None,
                "views": counts.views,
                "likes": counts.likes,
                "dislikes": counts.dislikes,
                "comments": self._build_comment_tree(comments),
            },
        )
        data = await self._rewrite_media_urls(base.model_dump())
        data["m3u8_url"] = await self._resolve_master_m3u8_url(m3u8_url)

        return VideoDetailResponse.model_validate(data)

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
            sort=sort or VideoSort.TRENDING_WEEK,
        )

        if page is not None:
            safe_page = max(1, page)
            safe_offset = (safe_page - 1) * safe_limit
        else:
            safe_offset = max(0, offset)

        rows = await self._repository.list_videos(
            filters=filters,
            limit=safe_limit,
            offset=safe_offset,
        )
        total = await self._repository.count_videos(filters=filters)
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

    async def get_video(self, video_id: int) -> VideoDetailResponse:
        """Return a single video by primary key with full relations.

        Local media URLs are rewritten to object-storage public URLs.
        Objects missing from the bucket are uploaded from local disk when
        available.

        Args:
            video_id: ``Video.id`` primary key.

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
        )
