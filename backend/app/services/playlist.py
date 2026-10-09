"""Playlist application service."""

from __future__ import annotations

import datetime
import uuid

from fastapi import HTTPException, status
from sqlmodel import select

from app.models.playlist import Playlist, PlaylistVideo
from app.models.user import User
from app.repositories.video import VideoRepository
from app.schemas.playlist import (
    PlaylistCreateRequest,
    PlaylistDetailResponse,
    PlaylistListResponse,
    PlaylistResponse,
    PlaylistUpdateRequest,
    PlaylistVisibilityChangeRequest,
)
from app.services.video import VideoService


class PlaylistService:
    """Business operations for user playlists."""

    def __init__(self, video_repository: VideoRepository) -> None:
        """Create a playlist service.

        Args:
            video_repository: Shared video data-access collaborator.
        """

        self._video_repository = video_repository

    @property
    def _session(self):
        """Return the bound async session."""

        return self._video_repository.session

    async def _to_response(
        self,
        playlist: Playlist,
        *,
        contains_video: bool | None = None,
        thumbnail_url: str | None = None,
    ) -> PlaylistResponse:
        """Map a playlist row to a summary response."""

        video_count = await PlaylistVideo.count_for_playlist(
            self._session,
            playlist.id,
        )

        return PlaylistResponse(
            id=playlist.id,
            owner_id=playlist.owner_id,
            name=playlist.name,
            description=playlist.description,
            visibility=playlist.visibility,
            video_count=video_count,
            thumbnail_url=thumbnail_url,
            contains_video=contains_video,
            created_at=playlist.created_at,
            updated_at=playlist.updated_at,
        )

    async def _require_playlist(
        self,
        playlist_id: uuid.UUID,
    ) -> Playlist:
        """Load a playlist or raise 404."""

        playlist = await Playlist.get_by_id(self._session, playlist_id)

        if playlist is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Playlist not found",
            )

        return playlist

    async def _require_owner(
        self,
        playlist: Playlist,
        user_id: uuid.UUID,
    ) -> None:
        """Raise 403 when the caller does not own the playlist."""

        if playlist.owner_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not allowed to modify this playlist",
            )

    async def _require_accessible(
        self,
        playlist: Playlist,
        user_id: uuid.UUID | None,
    ) -> None:
        """Raise 403 when the caller cannot view the playlist."""

        accessible = await Playlist.is_accessible_by(
            self._session,
            playlist,
            user_id,
        )

        if not accessible:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not allowed to view this playlist",
            )

    async def create(
        self,
        *,
        user_id: uuid.UUID,
        payload: PlaylistCreateRequest,
    ) -> PlaylistResponse:
        """Create a playlist owned by the authenticated user."""

        name = payload.name.strip()

        if not name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Playlist name is required",
            )

        playlist = Playlist.create(
            owner_id=user_id,
            name=name,
            visibility=payload.visibility,
            description=(
                payload.description.strip()
                if payload.description is not None
                else None
            ),
        )
        self._session.add(playlist)
        await self._session.commit()
        await self._session.refresh(playlist)

        return await self._to_response(playlist)

    async def list_owned(
        self,
        *,
        user_id: uuid.UUID,
        limit: int = 20,
        offset: int = 0,
        video_id: int | None = None,
    ) -> PlaylistListResponse:
        """List playlists owned by the authenticated user.

        When ``video_id`` is set, each item includes ``contains_video``.
        """

        safe_limit = max(1, min(limit, 100))
        safe_offset = max(0, offset)
        rows = await Playlist.list_owned_by_user(
            self._session,
            user_id,
            limit=safe_limit,
            offset=safe_offset,
        )
        total = await Playlist.count_owned_by_user(self._session, user_id)
        containing: set[uuid.UUID] = set()
        thumbnails: dict[uuid.UUID, str | None] = {}

        if rows:
            row_ids = [row.id for row in rows]
            thumbnails = (
                await PlaylistVideo.first_thumbnail_urls_for_playlists(
                    self._session,
                    row_ids,
                )
            )

            if video_id is not None:
                containing = await PlaylistVideo.playlist_ids_containing_video(
                    self._session,
                    row_ids,
                    video_id,
                )

        items = [
            await self._to_response(
                row,
                contains_video=(
                    row.id in containing if video_id is not None else None
                ),
                thumbnail_url=thumbnails.get(row.id),
            )
            for row in rows
        ]

        return PlaylistListResponse(
            items=items,
            total=total,
            limit=safe_limit,
            offset=safe_offset,
        )

    async def list_public_for_username(
        self,
        *,
        username: str,
        limit: int = 20,
        offset: int = 0,
    ) -> PlaylistListResponse:
        """List public playlists owned by ``username`` (no auth required)."""

        user_result = await self._session.exec(
            select(User).where(User.username == username)
        )
        user = user_result.first()

        if user is None or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found.",
            )

        safe_limit = max(1, min(limit, 100))
        safe_offset = max(0, offset)
        rows = await Playlist.list_public_by_owner(
            self._session,
            user.id,
            limit=safe_limit,
            offset=safe_offset,
        )
        total = await Playlist.count_public_by_owner(self._session, user.id)
        thumbnails: dict[uuid.UUID, str | None] = {}

        if rows:
            row_ids = [row.id for row in rows]
            thumbnails = (
                await PlaylistVideo.first_thumbnail_urls_for_playlists(
                    self._session,
                    row_ids,
                )
            )

        items = [
            await self._to_response(
                row,
                thumbnail_url=thumbnails.get(row.id),
            )
            for row in rows
        ]

        return PlaylistListResponse(
            items=items,
            total=total,
            limit=safe_limit,
            offset=safe_offset,
        )

    async def get_detail(
        self,
        playlist_id: uuid.UUID,
        *,
        user_id: uuid.UUID | None,
    ) -> PlaylistDetailResponse:
        """Return a playlist and its videos when accessible."""

        playlist = await self._require_playlist(playlist_id)
        await self._require_accessible(playlist, user_id)

        entries = await PlaylistVideo.get_videos_in_playlist(
            self._session,
            playlist.id,
        )
        video_ids = [int(entry.video_id) for entry in entries]
        video_service = VideoService(repository=self._video_repository)
        videos = await video_service.list_by_ids(video_ids)
        by_id = {int(video.id): video for video in videos}
        ordered = [
            by_id[video_id] for video_id in video_ids if video_id in by_id
        ]
        summary = await self._to_response(playlist)

        return PlaylistDetailResponse(
            **summary.model_dump(),
            videos=ordered,
        )

    async def update(
        self,
        playlist_id: uuid.UUID,
        *,
        user_id: uuid.UUID,
        payload: PlaylistUpdateRequest,
    ) -> PlaylistResponse:
        """Update playlist metadata (owner only)."""

        playlist = await self._require_playlist(playlist_id)
        await self._require_owner(playlist, user_id)

        if (
            payload.name is None
            and payload.description is None
            and payload.visibility is None
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update",
            )

        if payload.name is not None:
            name = payload.name.strip()

            if not name:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Playlist name is required",
                )

            playlist.rename(name)

        if payload.description is not None:
            text = payload.description.strip()
            playlist.description = text if text else None
            playlist.updated_at = datetime.datetime.now(
                datetime.timezone.utc,
            ).replace(tzinfo=None)

        if payload.visibility is not None:
            playlist.set_visibility(payload.visibility)

        self._session.add(playlist)
        await self._session.commit()
        await self._session.refresh(playlist)

        return await self._to_response(playlist)

    async def change_visibility(
        self,
        playlist_id: uuid.UUID,
        *,
        user_id: uuid.UUID,
        payload: PlaylistVisibilityChangeRequest,
    ) -> PlaylistResponse:
        """Set playlist visibility (owner only)."""

        playlist = await self._require_playlist(playlist_id)
        await self._require_owner(playlist, user_id)

        playlist.set_visibility(payload.visibility)

        self._session.add(playlist)
        await self._session.commit()
        await self._session.refresh(playlist)

        return await self._to_response(playlist)

    async def delete(
        self,
        playlist_id: uuid.UUID,
        *,
        user_id: uuid.UUID,
    ) -> None:
        """Delete a playlist (owner only)."""

        playlist = await self._require_playlist(playlist_id)
        await self._require_owner(playlist, user_id)
        await Playlist.delete(self._session, playlist)

    async def add_video(
        self,
        playlist_id: uuid.UUID,
        *,
        user_id: uuid.UUID,
        video_id: int,
    ) -> PlaylistResponse:
        """Append a video to a playlist (owner only)."""

        playlist = await self._require_playlist(playlist_id)
        await self._require_owner(playlist, user_id)

        if not await self._video_repository.exists_by_id(video_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Video not found",
            )

        existing = await PlaylistVideo.get_by_playlist_and_video(
            self._session,
            playlist.id,
            video_id,
        )

        if existing is not None:
            return await self._to_response(playlist)

        await PlaylistVideo.add_video(
            self._session,
            playlist.id,
            video_id,
        )
        playlist.updated_at = datetime.datetime.now(
            datetime.timezone.utc,
        ).replace(tzinfo=None)
        self._session.add(playlist)
        await self._session.commit()
        await self._session.refresh(playlist)

        return await self._to_response(playlist)

    async def remove_video(
        self,
        playlist_id: uuid.UUID,
        *,
        user_id: uuid.UUID,
        video_id: int,
    ) -> PlaylistResponse:
        """Remove a video from a playlist (owner only)."""

        playlist = await self._require_playlist(playlist_id)
        await self._require_owner(playlist, user_id)

        deleted = await PlaylistVideo.remove_video(
            self._session,
            playlist.id,
            video_id,
        )

        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Video is not in this playlist",
            )

        playlist.updated_at = datetime.datetime.now(
            datetime.timezone.utc,
        ).replace(tzinfo=None)
        self._session.add(playlist)
        await self._session.commit()
        await self._session.refresh(playlist)

        return await self._to_response(playlist)
