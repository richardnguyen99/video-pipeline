"""Public user profile endpoints."""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Query, status

from app.dependencies import CurrentUserDep
from app.dependencies.repositories import UserRepositoryDep
from app.dependencies.services import (
    ActressSubscribeServiceDep,
    PlaylistServiceDep,
)
from app.schemas.actress_subscribe import ActressSubscribeListResponse
from app.schemas.playlist import PlaylistListResponse
from app.schemas.user import UserSearchItem, UserSearchResponse
from app.schemas.user_bio import UserBioResponse

router = APIRouter(prefix="/users")


@router.get(
    "/search",
    response_model=UserSearchResponse,
    status_code=status.HTTP_200_OK,
    summary="Search users by username or email",
    responses={
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Missing or invalid authentication",
        },
    },
)
async def search_users(
    current_user: CurrentUserDep,
    repository: UserRepositoryDep,
    q: Annotated[
        str,
        Query(
            min_length=1,
            max_length=100,
            description="Substring matched against username and email.",
        ),
    ],
    limit: int = Query(default=10, ge=1, le=50),
) -> UserSearchResponse:
    """Return active users matching ``q`` (authenticated callers only)."""

    rows = await repository.search_by_username_or_email(
        q,
        limit=limit,
        exclude_user_id=current_user.id,
    )

    return UserSearchResponse(
        items=[
            UserSearchItem(
                id=user.id,
                username=user.username,
                email=user.email,
                display_name=preferred_name,
            )
            for user, preferred_name in rows
        ],
    )


@router.get(
    "/{username}/bio",
    response_model=UserBioResponse,
    status_code=status.HTTP_200_OK,
    summary="Return a user's public biography",
    responses={
        status.HTTP_404_NOT_FOUND: {
            "description": "No user with this username.",
        },
    },
)
async def get_public_user_bio(
    username: Annotated[
        str,
        Path(
            min_length=3,
            max_length=50,
            description="Public username handle.",
        ),
    ],
    repository: UserRepositoryDep,
) -> UserBioResponse:
    """Return biography fields for a public profile.

    Biography is public by default. When the user has no bio row, every
    field is null (no 404 for missing bio).
    """

    user = await repository.get_by_username(username)

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    bio = await repository.get_bio_by_user_id(user.id)

    if bio is None:
        return UserBioResponse()

    return UserBioResponse.model_validate(bio)


@router.get(
    "/{username}/playlists",
    response_model=PlaylistListResponse,
    status_code=status.HTTP_200_OK,
    summary="List a user's public playlists",
    responses={
        status.HTTP_404_NOT_FOUND: {
            "description": "No user with this username.",
        },
    },
)
async def list_public_user_playlists(
    service: PlaylistServiceDep,
    username: Annotated[
        str,
        Path(
            min_length=3,
            max_length=50,
            description="Public username handle.",
        ),
    ],
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> PlaylistListResponse:
    """Return public playlists owned by ``username``.

    Available without authentication. Private and restricted playlists
    are never included.
    """

    return await service.list_public_for_username(
        username=username,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/me/actress-subscriptions",
    response_model=ActressSubscribeListResponse,
    status_code=status.HTTP_200_OK,
    summary="List the authenticated user's actress subscriptions",
    responses={
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Missing or invalid authentication",
        },
    },
)
async def list_my_actress_subscriptions(
    current_user: CurrentUserDep,
    service: ActressSubscribeServiceDep,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> ActressSubscribeListResponse:
    """Return actresses the caller is subscribed to (newest first)."""

    return await service.list_for_user(
        user_id=current_user.id,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/{username}/actress-subscriptions",
    response_model=ActressSubscribeListResponse,
    status_code=status.HTTP_200_OK,
    summary="List a user's actress subscriptions",
    responses={
        status.HTTP_404_NOT_FOUND: {
            "description": "No user with this username.",
        },
    },
)
async def list_user_actress_subscriptions(
    service: ActressSubscribeServiceDep,
    username: Annotated[
        str,
        Path(
            min_length=3,
            max_length=50,
            description="Public username handle.",
        ),
    ],
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> ActressSubscribeListResponse:
    """Return actresses ``username`` is subscribed to (newest first)."""

    return await service.list_for_username(
        username=username,
        limit=limit,
        offset=offset,
    )
