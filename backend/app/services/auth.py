"""Authentication application service."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

from app.models.credentials import UserCredential
from app.repositories.user import UserRepository
from app.schemas.auth import LoginRequest, RegisterRequest, UserResponse
from app.utils.password import (
    PASSWORD_ALGORITHM,
    hash_password,
    verify_password,
)


class AuthService:
    """Registration, login, and related auth operations."""

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

    async def login(self, payload: LoginRequest) -> UserResponse:
        """Authenticate a user by email and password.

        Failed attempts use a generic error so callers cannot enumerate
        accounts. Locked accounts receive a 403 until the lock expires.

        Args:
            payload: Validated login body.

        Returns:
            Public user profile for the authenticated account.

        Raises:
            HTTPException: 401 for invalid credentials, 403 when locked
                or inactive.
        """

        invalid = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

        user = await self._repository.get_by_email(payload.email)

        if user is None:
            raise invalid

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is disabled.",
            )

        credential = await UserCredential.get_by_user_id(
            self._repository.session,
            user.id,
        )

        if credential is None:
            raise invalid

        locked_until = credential.locked_until

        if locked_until is not None:
            if locked_until.tzinfo is None:
                locked_until = locked_until.replace(tzinfo=timezone.utc)

            if locked_until > datetime.now(timezone.utc):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Account is temporarily locked. Try again later.",
                )

        if not verify_password(payload.password, credential.password_hash):
            await self._repository.record_login_failure(user)
            raise invalid

        user = await self._repository.record_login_success(user)

        return UserResponse.model_validate(user)

    async def get_current_user(self, user_id: uuid.UUID) -> UserResponse:
        """Load the public profile for an authenticated user id.

        Args:
            user_id: Subject from a verified access JWT.

        Returns:
            Public user profile.

        Raises:
            HTTPException: 401 when the user is missing or inactive.
        """

        user = await self._repository.get_by_id(user_id)

        if user is None or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )

        return UserResponse.model_validate(user)
