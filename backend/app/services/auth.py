"""Authentication application service."""

from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

from app.repositories.user import UserRepository
from app.schemas.auth import RegisterRequest, UserResponse
from app.utils.password import PASSWORD_ALGORITHM, hash_password


class AuthService:
    """Registration and related auth operations."""

    def __init__(self, repository: UserRepository) -> None:
        """Create an auth service.

        Args:
            repository: User data-access collaborator.
        """

        self._repository = repository

    async def register(self, payload: RegisterRequest) -> UserResponse:
        """Register a new user with a bcrypt-hashed password.

        Args:
            payload: Validated registration body.

        Returns:
            Public user profile for the created account.

        Raises:
            HTTPException: 409 when username or email is already taken.
        """

        existing_username = await self._repository.get_by_username(
            payload.username,
        )

        if existing_username is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username is already taken.",
            )

        existing_email = await self._repository.get_by_email(payload.email)

        if existing_email is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email is already registered.",
            )

        password_hash = hash_password(payload.password)

        try:
            user = await self._repository.create_with_credential(
                username=payload.username,
                email=payload.email,
                password_hash=password_hash,
                password_algorithm=PASSWORD_ALGORITHM,
                display_name=payload.display_name,
            )
        except IntegrityError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username or email is already registered.",
            ) from exc

        return UserResponse.model_validate(user)
