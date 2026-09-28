"""Authentication application service."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

from app.config import settings
from app.models.credentials import UserCredential
from app.models.refresh_token import RefreshToken
from app.repositories.refresh_token import RefreshTokenRepository
from app.repositories.user import UserRepository
from app.schemas.auth import LoginRequest, RegisterRequest, UserResponse
from app.utils.jwt import create_access_token, create_refresh_token
from app.utils.password import (
    PASSWORD_ALGORITHM,
    hash_password,
    verify_password,
)
from app.utils.refresh_token_hash import hash_refresh_token


class AuthService:
    """Registration, login, and refresh-token allowlist operations."""

    def __init__(
        self,
        repository: UserRepository,
        refresh_tokens: RefreshTokenRepository,
    ) -> None:
        """Create an auth service.

        Args:
            repository: User data-access collaborator.
            refresh_tokens: Refresh-token allowlist repository.
        """

        self._repository = repository
        self._refresh_tokens = refresh_tokens

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

    async def issue_session_tokens(
        self,
        user: UserResponse,
        *,
        user_agent: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> tuple[str, str]:
        """Mint access + refresh JWTs and allowlist the refresh token.

        Args:
            user: Authenticated public profile.
            user_agent: Optional client user-agent for the session row.
            ip_address: Optional client IP for the session row.

        Returns:
            ``(access_token, refresh_token)`` raw JWT strings.
        """

        access = create_access_token(
            user_id=user.id,
            email=user.email,
            username=user.username,
        )
        refresh = create_refresh_token(user_id=user.id)
        expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=settings.jwt_refresh_token_expire_minutes,
        )
        await self._refresh_tokens.issue(
            user_id=user.id,
            token_hash=hash_refresh_token(refresh),
            expires_at=expires_at,
            user_agent=user_agent,
            ip_address=ip_address,
        )

        return access, refresh

    async def get_allowlisted_refresh_token(
        self,
        raw_refresh_token: str,
        *,
        for_update: bool = True,
    ) -> RefreshToken:
        """Load and validate an allowlisted refresh token (or 401).

        Args:
            raw_refresh_token: Raw refresh JWT from the cookie.
            for_update: Lock the row for rotation.

        Returns:
            The active allowlist row.

        Raises:
            HTTPException: 401 when missing, revoked, or expired.
        """

        token_hash = hash_refresh_token(raw_refresh_token)
        row = await self._refresh_tokens.get_by_token_hash(
            token_hash,
            for_update=for_update,
        )

        if row is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token is not recognized.",
            )

        if row.revoked_at is not None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token has been revoked.",
            )

        if not self._refresh_tokens.is_usable(row):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token has expired.",
            )

        return row

    async def rotate_session_tokens(
        self,
        *,
        current: RefreshToken,
        user: UserResponse,
        user_agent: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> tuple[str, str]:
        """Revoke ``current`` in the allowlist and issue a new pair.

        Args:
            current: Locked allowlist row for the presented refresh token.
            user: Public profile for the session owner.
            user_agent: Optional client user-agent.
            ip_address: Optional client IP.

        Returns:
            ``(access_token, refresh_token)`` for the rotated session.
        """

        access = create_access_token(
            user_id=user.id,
            email=user.email,
            username=user.username,
        )
        new_refresh = create_refresh_token(user_id=user.id)
        expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=settings.jwt_refresh_token_expire_minutes,
        )
        await self._refresh_tokens.rotate(
            current=current,
            new_token_hash=hash_refresh_token(new_refresh),
            new_expires_at=expires_at,
            user_agent=user_agent,
            ip_address=ip_address,
        )

        return access, new_refresh

    async def revoke_refresh_token(self, raw_refresh_token: str) -> None:
        """Remove a refresh token from the allowlist (logout).

        Missing rows are ignored so logout stays idempotent.
        """

        token_hash = hash_refresh_token(raw_refresh_token)
        await self._refresh_tokens.revoke_by_token_hash(token_hash)

    async def find_refresh_token_by_raw(
        self,
        raw_refresh_token: str,
    ) -> Optional[RefreshToken]:
        """Look up an allowlist row without enforcing active status."""

        return await self._refresh_tokens.get_by_token_hash(
            hash_refresh_token(raw_refresh_token),
            for_update=False,
        )
