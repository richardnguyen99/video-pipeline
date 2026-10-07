"""Playlist collection and membership endpoints."""

from uuid import UUID

from fastapi import APIRouter, Path, Query, status

from app.dependencies import CurrentUserDep, PlaylistServiceDep
from app.schemas.playlist import (
    PlaylistAddVideoRequest,
    PlaylistCreateRequest,
    PlaylistDetailResponse,
    PlaylistListResponse,
    PlaylistResponse,
    PlaylistUpdateRequest,
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
) -> PlaylistListResponse:
    """Return playlists owned by the authenticated user."""

    return await service.list_owned(
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
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Missing or invalid authentication",
        },
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
    current_user: CurrentUserDep,
    playlist_id: UUID = Path(..., description="Playlist primary key."),
) -> PlaylistDetailResponse:
    """Return a playlist and ordered video cards when accessible."""

    return await service.get_detail(
        playlist_id,
        user_id=current_user.id,
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
