"""Playlist collection and membership endpoints."""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Path, Query, status

from app.dependencies import (
    CurrentUserDep,
    OptionalCurrentUserDep,
    PlaylistServiceDep,
)
from app.schemas.playlist import (
    PlaylistAddVideoRequest,
    PlaylistCreateRequest,
    PlaylistDetailResponse,
    PlaylistListResponse,
    PlaylistResponse,
    PlaylistShareListResponse,
    PlaylistShareRequest,
    PlaylistShareResponse,
    PlaylistUpdateRequest,
    PlaylistVisibilityChangeRequest,
)

router = APIRouter()


@router.post(
    "/playlists",
    response_model=PlaylistResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a playlist",
    responses={
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Missing or invalid authentication",
        },
        status.HTTP_400_BAD_REQUEST: {
            "description": "Invalid playlist payload",
        },
    },
)
async def create_playlist(
    service: PlaylistServiceDep,
    current_user: CurrentUserDep,
    payload: PlaylistCreateRequest,
) -> PlaylistResponse:
    """Create a playlist owned by the authenticated user."""

    return await service.create(user_id=current_user.id, payload=payload)


@router.get(
    "/playlists",
    response_model=PlaylistListResponse,
    status_code=status.HTTP_200_OK,
    summary="List owned playlists",
    responses={
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Missing or invalid authentication",
        },
    },
)
async def list_playlists(
    service: PlaylistServiceDep,
    current_user: CurrentUserDep,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    video_id: Optional[int] = Query(
        default=None,
        ge=1,
        description="When set, each item includes contains_video.",
    ),
) -> PlaylistListResponse:
    """Return playlists owned by the authenticated user."""

    return await service.list_owned(
        user_id=current_user.id,
        limit=limit,
        offset=offset,
        video_id=video_id,
    )


@router.get(
    "/playlists/shared",
    response_model=PlaylistListResponse,
    status_code=status.HTTP_200_OK,
    summary="List playlists shared with the current user",
    responses={
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Missing or invalid authentication",
        },
    },
)
async def list_shared_playlists(
    service: PlaylistServiceDep,
    current_user: CurrentUserDep,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> PlaylistListResponse:
    """Return restricted playlists shared with the authenticated user."""

    return await service.list_shared_with_me(
        user_id=current_user.id,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/playlists/{playlist_id}",
    response_model=PlaylistDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get playlist with videos",
    responses={
        status.HTTP_403_FORBIDDEN: {
            "description": "Not allowed to view this playlist",
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "Playlist not found",
        },
    },
)
async def get_playlist(
    service: PlaylistServiceDep,
    current_user: OptionalCurrentUserDep,
    playlist_id: UUID = Path(..., description="Playlist primary key."),
) -> PlaylistDetailResponse:
    """Return a playlist and ordered video cards when accessible.

    Public playlists are available without authentication.
    """

    return await service.get_detail(
        playlist_id,
        user_id=current_user.id if current_user is not None else None,
    )


@router.patch(
    "/playlists/{playlist_id}",
    response_model=PlaylistResponse,
    status_code=status.HTTP_200_OK,
    summary="Update playlist metadata",
    responses={
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Missing or invalid authentication",
        },
        status.HTTP_403_FORBIDDEN: {
            "description": "Not allowed to modify this playlist",
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "Playlist not found",
        },
        status.HTTP_400_BAD_REQUEST: {
            "description": "Invalid update payload",
        },
    },
)
async def update_playlist(
    service: PlaylistServiceDep,
    current_user: CurrentUserDep,
    payload: PlaylistUpdateRequest,
    playlist_id: UUID = Path(..., description="Playlist primary key."),
) -> PlaylistResponse:
    """Rename, describe, or change visibility (owner only)."""

    return await service.update(
        playlist_id,
        user_id=current_user.id,
        payload=payload,
    )


@router.patch(
    "/playlists/{playlist_id}/visibility",
    response_model=PlaylistResponse,
    status_code=status.HTTP_200_OK,
    summary="Change playlist visibility",
    responses={
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Missing or invalid authentication",
        },
        status.HTTP_403_FORBIDDEN: {
            "description": "Not allowed to modify this playlist",
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "Playlist not found",
        },
    },
)
async def change_playlist_visibility(
    service: PlaylistServiceDep,
    current_user: CurrentUserDep,
    payload: PlaylistVisibilityChangeRequest,
    playlist_id: UUID = Path(..., description="Playlist primary key."),
) -> PlaylistResponse:
    """Set visibility to private, restricted, or public (owner only).

    * ``private`` — only the owner can see the playlist
    * ``restricted`` — owner and authenticated users with a share
    * ``public`` — everyone can see the playlist
    """

    return await service.change_visibility(
        playlist_id,
        user_id=current_user.id,
        payload=payload,
    )


@router.delete(
    "/playlists/{playlist_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a playlist",
    responses={
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Missing or invalid authentication",
        },
        status.HTTP_403_FORBIDDEN: {
            "description": "Not allowed to modify this playlist",
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "Playlist not found",
        },
    },
)
async def delete_playlist(
    service: PlaylistServiceDep,
    current_user: CurrentUserDep,
    playlist_id: UUID = Path(..., description="Playlist primary key."),
) -> None:
    """Delete a playlist owned by the authenticated user."""

    await service.delete(playlist_id, user_id=current_user.id)


@router.post(
    "/playlists/{playlist_id}/videos",
    response_model=PlaylistResponse,
    status_code=status.HTTP_200_OK,
    summary="Add a video to a playlist",
    responses={
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Missing or invalid authentication",
        },
        status.HTTP_403_FORBIDDEN: {
            "description": "Not allowed to modify this playlist",
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "Playlist or video not found",
        },
    },
)
async def add_playlist_video(
    service: PlaylistServiceDep,
    current_user: CurrentUserDep,
    payload: PlaylistAddVideoRequest,
    playlist_id: UUID = Path(..., description="Playlist primary key."),
) -> PlaylistResponse:
    """Append a video to the end of a playlist (owner only)."""

    return await service.add_video(
        playlist_id,
        user_id=current_user.id,
        video_id=payload.video_id,
    )


@router.delete(
    "/playlists/{playlist_id}/videos/{video_id}",
    response_model=PlaylistResponse,
    status_code=status.HTTP_200_OK,
    summary="Remove a video from a playlist",
    responses={
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Missing or invalid authentication",
        },
        status.HTTP_403_FORBIDDEN: {
            "description": "Not allowed to modify this playlist",
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "Playlist or membership not found",
        },
    },
)
async def remove_playlist_video(
    service: PlaylistServiceDep,
    current_user: CurrentUserDep,
    playlist_id: UUID = Path(..., description="Playlist primary key."),
    video_id: int = Path(..., ge=1, description="Video primary key."),
) -> PlaylistResponse:
    """Remove a video from a playlist (owner only)."""

    return await service.remove_video(
        playlist_id,
        user_id=current_user.id,
        video_id=video_id,
    )


@router.get(
    "/playlists/{playlist_id}/shares",
    response_model=PlaylistShareListResponse,
    status_code=status.HTTP_200_OK,
    summary="List shared users",
    responses={
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Missing or invalid authentication",
        },
        status.HTTP_403_FORBIDDEN: {
            "description": "Not allowed to manage this playlist",
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "Playlist not found",
        },
    },
)
async def list_playlist_shares(
    service: PlaylistServiceDep,
    current_user: CurrentUserDep,
    playlist_id: UUID = Path(..., description="Playlist primary key."),
) -> PlaylistShareListResponse:
    """Return users who can view a restricted playlist (owner only)."""

    return await service.list_shares(
        playlist_id,
        user_id=current_user.id,
    )


@router.post(
    "/playlists/{playlist_id}/shares",
    response_model=PlaylistShareResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Share playlist with a user",
    responses={
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Missing or invalid authentication",
        },
        status.HTTP_403_FORBIDDEN: {
            "description": "Not allowed to manage this playlist",
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "Playlist or user not found",
        },
        status.HTTP_400_BAD_REQUEST: {
            "description": "Playlist is not restricted or invalid username",
        },
    },
)
async def add_playlist_share(
    service: PlaylistServiceDep,
    current_user: CurrentUserDep,
    payload: PlaylistShareRequest,
    playlist_id: UUID = Path(..., description="Playlist primary key."),
) -> PlaylistShareResponse:
    """Grant restricted access to a user by username (owner only)."""

    return await service.add_share(
        playlist_id,
        user_id=current_user.id,
        payload=payload,
    )


@router.delete(
    "/playlists/{playlist_id}/shares/{shared_user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke playlist share",
    responses={
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Missing or invalid authentication",
        },
        status.HTTP_403_FORBIDDEN: {
            "description": "Not allowed to manage this playlist",
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "Playlist or share not found",
        },
    },
)
async def remove_playlist_share(
    service: PlaylistServiceDep,
    current_user: CurrentUserDep,
    playlist_id: UUID = Path(..., description="Playlist primary key."),
    shared_user_id: UUID = Path(
        ...,
        description="User id of the shared viewer.",
    ),
) -> None:
    """Remove a user's access to a restricted playlist (owner only)."""

    await service.remove_share(
        playlist_id,
        user_id=current_user.id,
        shared_with_user_id=shared_user_id,
    )
