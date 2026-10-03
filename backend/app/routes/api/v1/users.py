"""Public user profile endpoints."""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, status

from app.dependencies.repositories import UserRepositoryDep
from app.schemas.user_bio import UserBioResponse

router = APIRouter(prefix="/users")


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
