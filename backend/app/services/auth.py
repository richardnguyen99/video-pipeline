"""Authentication application service."""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

from app.config import settings
from app.models.credentials import UserCredential
from app.models.refresh_token import RefreshToken
from app.models.user_activity import UserActivity, UserActivityType
from app.repositories.refresh_token import RefreshTokenRepository
from app.repositories.user import UserRepository
from app.schemas.auth import (
    AuthSessionItem,
    AuthSessionListResponse,
    ChangePasswordRequest,
    ChangeUsernameRequest,
    ForgotPasswordRequest,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    UserActivityItem,
    UserActivityListResponse,
    UserResponse,
)
from app.schemas.user_bio import Gender, UserBioResponse, UserBioUpdateRequest
from app.services.email import EmailService
from app.utils.email_verification import AsyncKeyValueStore
from app.utils.ip_location import format_location, resolve_ip_location
from app.utils.jwt import create_access_token, create_refresh_token
from app.utils.password import (
    PASSWORD_ALGORITHM,
    hash_password,
    verify_password,
)
from app.utils.password_reset import (
    consume_password_reset_token,
    generate_password_reset_token,
    get_password_reset_cooldown_remaining,
    store_password_reset_token,
)
from app.utils.refresh_token_hash import hash_refresh_token
from app.utils.user_agent import format_user_agent


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

        await UserActivity.record(
            self._repository.session,
            user_id=user.id,
            event_type=UserActivityType.USER_CREATE,
            metadata={
                "username": user.username,
                "email": user.email,
            },
            commit=True,
        )

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

    async def get_bio(self, user: UserResponse) -> UserBioResponse:
        """Return the biography for the authenticated user.

        When no bio row exists, every field is null.

        Args:
            user: Authenticated public profile.

        Returns:
            Biography response (possibly all-null).
        """

        bio = await self._repository.get_bio_by_user_id(user.id)

        if bio is None:
            return UserBioResponse()

        return UserBioResponse.model_validate(bio)

    async def update_bio(
        self,
        user: UserResponse,
        payload: UserBioUpdateRequest,
    ) -> UserBioResponse:
        """Create or partially update the biography for the authenticated user.

        Args:
            user: Authenticated public profile.
            payload: Validated biography fields (all optional).

        Returns:
            Updated biography response.

        Raises:
            HTTPException: 400 when ``gender`` is set to an unsupported value.
        """

        fields_set = set(payload.model_fields_set)
        gender = payload.gender

        if "gender" in fields_set and gender is not None:
            try:
                gender = Gender(gender).value
            except ValueError as exc:
                allowed = ", ".join(item.value for item in Gender)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "Unsupported gender value. "
                        f"Allowed values: {allowed}."
                    ),
                ) from exc

        bio = await self._repository.upsert_bio(
            user.id,
            full_name=payload.full_name,
            date_of_birth=payload.date_of_birth,
            country=payload.country,
            gender=gender,
            biography=payload.biography,
            link=payload.link,
            fields_set=fields_set,
        )

        return UserBioResponse.model_validate(bio)

    async def ensure_access_token_not_superseded(
        self,
        user_id: uuid.UUID,
        claims: dict[str, Any],
    ) -> None:
        """Reject access tokens issued before the last password change.

        After ``change_password`` / password reset, every refresh token is
        revoked. Short-lived access tokens on other devices may still be
        valid until expiry; comparing ``iat`` to ``password_changed_at``
        ends those sessions immediately without storing access JTIs.

        Args:
            user_id: Subject from the access JWT.
            claims: Verified access-token claims (must include ``iat``).

        Raises:
            HTTPException: 401 when the token predates the password change.
        """

        credential = await UserCredential.get_by_user_id(
            self._repository.session,
            user_id,
        )

        if credential is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        changed_at = credential.password_changed_at

        if changed_at is None:
            return

        if changed_at.tzinfo is None:
            changed_at = changed_at.replace(tzinfo=timezone.utc)
        else:
            changed_at = changed_at.astimezone(timezone.utc)

        iat = claims.get("iat")

        if iat is None:
            return

        if isinstance(iat, datetime):
            issued_at = (
                iat
                if iat.tzinfo is not None
                else iat.replace(
                    tzinfo=timezone.utc,
                )
            )
        else:
            issued_at = datetime.fromtimestamp(int(iat), tz=timezone.utc)

        # Compare at second precision (JWT ``iat`` is NumericDate). Tokens
        # issued strictly before the checkpoint second are rejected. Tokens
        # issued in the same second or later (e.g. login right after
        # sign-out-all) remain valid so re-authentication is not rejected.
        issued_ts = int(issued_at.astimezone(timezone.utc).timestamp())
        changed_ts = int(changed_at.timestamp())

        if issued_ts < changed_ts:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Access token has been revoked.",
                headers={"WWW-Authenticate": "Bearer"},
            )

    async def issue_session_tokens(
        self,
        user: UserResponse,
        *,
        remember_me: bool = False,
        user_agent: Optional[str] = None,
        ip_address: Optional[str] = None,
        record_login_activity: bool = False,
    ) -> tuple[str, str]:
        """Mint access + refresh JWTs and allowlist the refresh token.

        Each call creates a new independent session. Other active refresh
        tokens for the same user (other browsers/devices) remain valid.

        Login history is written only when ``record_login_activity`` is true
        (explicit ``POST /auth/login``). Token rotation / refresh must leave
        this flag false so the activity log is not polluted.

        Args:
            user: Authenticated public profile.
            remember_me: Persist the refresh cookie across browser restarts.
            user_agent: Optional client user-agent for the session row.
            ip_address: Optional client IP for the session row.
            record_login_activity: When true, append a ``login`` activity row.

        Returns:
            ``(access_token, refresh_token)`` raw JWT strings.
        """

        access = create_access_token(
            user_id=user.id,
            email=user.email,
            username=user.username,
        )
        refresh = create_refresh_token(
            user_id=user.id,
            remember_me=remember_me,
        )
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

        if record_login_activity:
            await UserActivity.record(
                self._repository.session,
                user_id=user.id,
                event_type=UserActivityType.LOGIN,
                metadata=None,
                ip_address=ip_address,
                user_agent=user_agent,
                commit=True,
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
        remember_me: bool = False,
        user_agent: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> tuple[str, str]:
        """Revoke ``current`` in the allowlist and issue a new pair.

        Args:
            current: Locked allowlist row for the presented refresh token.
            user: Public profile for the session owner.
            remember_me: Carry the original login cookie persistence policy.
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
        new_refresh = create_refresh_token(
            user_id=user.id,
            remember_me=remember_me,
        )
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
        """Revoke a single refresh token (one device session logout).

        Does not affect other concurrent sessions for the same user.
        Missing rows are ignored so logout stays idempotent.
        """

        token_hash = hash_refresh_token(raw_refresh_token)
        await self._refresh_tokens.revoke_by_token_hash(token_hash)

    async def revoke_all_refresh_tokens(self, user_id: uuid.UUID) -> int:
        """Revoke every active refresh token for ``user_id``.

        Also advances the credential session checkpoint so short-lived
        access tokens on other devices fail ``ensure_access_token_not_superseded``
        on the next request without waiting for natural expiry.

        Args:
            user_id: Account whose sessions must end.

        Returns:
            Number of allowlist rows revoked.
        """

        count = await self._refresh_tokens.revoke_all_for_user(user_id)
        await self._repository.bump_sessions_revoked_at(user_id)

        return count

    async def list_sessions(
        self,
        user_id: uuid.UUID,
        *,
        current_refresh_token: Optional[str] = None,
    ) -> AuthSessionListResponse:
        """List only active (non-revoked, non-expired) device sessions."""

        rows = await self._refresh_tokens.list_active_for_user(user_id)
        current_hash: Optional[str] = None

        if current_refresh_token is not None and current_refresh_token.strip():
            current_hash = hash_refresh_token(current_refresh_token.strip())

        active_rows = [row for row in rows if row.is_active]

        locations = await asyncio.gather(
            *[
                asyncio.to_thread(resolve_ip_location, row.ip_address)
                for row in active_rows
            ],
        )

        items: list[AuthSessionItem] = []

        for row, resolved in zip(active_rows, locations, strict=True):
            items.append(
                AuthSessionItem(
                    id=row.id,
                    ip_address=row.ip_address,
                    user_agent=row.user_agent,
                    browser_label=format_user_agent(row.user_agent),
                    location=format_location(resolved),
                    last_logged_in=row.issued_at,
                    is_current=(
                        current_hash is not None
                        and row.token_hash == current_hash
                    ),
                ),
            )

        return AuthSessionListResponse(items=items)

    async def revoke_session_by_id(
        self,
        user_id: uuid.UUID,
        session_id: uuid.UUID,
    ) -> None:
        """Revoke one session owned by ``user_id``."""

        row = await self._refresh_tokens.get_by_id_for_user(
            session_id, user_id
        )

        if row is None or row.revoked_at is not None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found.",
            )

        await self._refresh_tokens.revoke(row)

    async def change_password(
        self,
        user: UserResponse,
        payload: ChangePasswordRequest,
    ) -> None:
        """Verify the current password, set a new hash, revoke all sessions.

        Args:
            user: Authenticated caller from the access JWT.
            payload: Current and new password fields.

        Raises:
            HTTPException: 400 when the new password matches the current one;
                401 when the current password is wrong; 401 when credentials
                are missing.
        """

        if payload.current_password == payload.new_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password must be different from the current password.",
            )

        credential = await UserCredential.get_by_user_id(
            self._repository.session,
            user.id,
        )

        if credential is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated.",
            )

        if not verify_password(
            payload.current_password,
            credential.password_hash,
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Current password is incorrect.",
            )

        new_hash = hash_password(payload.new_password)

        await self._repository.update_password(
            user.id,
            password_hash=new_hash,
            password_algorithm=PASSWORD_ALGORITHM,
        )
        await UserActivity.record(
            self._repository.session,
            user_id=user.id,
            event_type=UserActivityType.PASSWORD_CHANGE,
            commit=True,
        )
        await self.revoke_all_refresh_tokens(user.id)

    async def request_password_reset(
        self,
        payload: ForgotPasswordRequest,
        *,
        redis: AsyncKeyValueStore,
        email_service: EmailService,
    ) -> str:
        """Send a password-reset link when the email matches an account.

        Always returns a generic detail string so callers cannot probe whether
        an address is registered. Rate-limits resends per email address.

        Args:
            payload: Normalized email address.
            redis: Redis client for the hashed token allowlist.
            email_service: Resend-backed mailer.

        Returns:
            Public acknowledgement message.

        Raises:
            HTTPException: 429 when the resend cooldown is active.
        """

        detail = (
            "If an account exists for that email, a password-reset link "
            "has been sent. The link expires in "
            f"{settings.password_reset_expire_minutes} minutes."
        )

        cooldown_remaining = await get_password_reset_cooldown_remaining(
            redis,
            payload.email,
        )

        if cooldown_remaining > 0:
            minutes = max(1, (cooldown_remaining + 59) // 60)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    "Please wait before requesting another password-reset "
                    f"email. Try again in about {minutes} minute"
                    f"{'s' if minutes != 1 else ''}."
                ),
                headers={"Retry-After": str(cooldown_remaining)},
            )

        user = await self._repository.get_by_email(payload.email)

        if user is None or not user.is_active:
            return detail

        raw_token = generate_password_reset_token()
        ttl_seconds = max(60, settings.password_reset_expire_minutes * 60)
        cooldown_seconds = max(
            0,
            settings.password_reset_resend_cooldown_minutes * 60,
        )
        await store_password_reset_token(
            redis,
            user_id=user.id,
            email=payload.email,
            raw_token=raw_token,
            ttl_seconds=ttl_seconds,
            cooldown_seconds=cooldown_seconds,
        )

        base = settings.frontend_base_url.rstrip("/")
        reset_url = f"{base}/reset-password?token={raw_token}"
        minutes = settings.password_reset_expire_minutes
        html = (
            "<div style=\"font-family:sans-serif;padding:24px;\">"
            "<h1>Reset your password</h1>"
            f"<p>Hi {user.username},</p>"
            "<p>Choose a new password for your Velvet account by opening "
            f"this link (expires in {minutes} minutes):</p>"
            f'<p><a href="{reset_url}">{reset_url}</a></p>'
            "<p>If you did not request a reset, ignore this message.</p>"
            "</div>"
        )
        text = (
            f"Reset your Velvet password (expires in {minutes} minutes):\n"
            f"{reset_url}\n"
        )
        email_service.send_email(
            to=[user.email],
            subject="Reset your Velvet password",
            html=html,
            text=text,
        )

        return detail

    async def confirm_password_reset(
        self,
        payload: ResetPasswordRequest,
        *,
        redis: AsyncKeyValueStore,
    ) -> None:
        """Consume a reset token, set a new password, revoke all sessions.

        Args:
            payload: Opaque token and new password.
            redis: Redis client holding the hashed token.

        Raises:
            HTTPException: 400 when the token is missing, expired, or invalid.
        """

        user_id = await consume_password_reset_token(redis, payload.token)

        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password-reset link is invalid or has expired.",
            )

        user = await self._repository.get_by_id(user_id)

        if user is None or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password-reset link is invalid or has expired.",
            )

        new_hash = hash_password(payload.new_password)
        await self._repository.update_password(
            user_id,
            password_hash=new_hash,
            password_algorithm=PASSWORD_ALGORITHM,
        )
        await self.revoke_all_refresh_tokens(user_id)

    async def find_refresh_token_by_raw(
        self,
        raw_refresh_token: str,
    ) -> Optional[RefreshToken]:
        """Look up an allowlist row without enforcing active status."""

        return await self._refresh_tokens.get_by_token_hash(
            hash_refresh_token(raw_refresh_token),
            for_update=False,
        )

    async def change_username(
        self,
        user: UserResponse,
        payload: ChangeUsernameRequest,
    ) -> UserResponse:
        """Update the authenticated user's unique username.

        Raises:
            HTTPException: 400 when unchanged or invalid; 409 when taken.
        """

        new_username = payload.username

        if new_username.lower() == user.username.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New username must be different from the current username.",
            )

        existing = await self._repository.get_by_username(new_username)

        if existing is not None and existing.id != user.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username is already taken.",
            )

        previous_username = user.username

        try:
            updated = await self._repository.update_username(
                user.id,
                username=new_username,
            )
        except IntegrityError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username is already taken.",
            ) from exc

        if updated is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated.",
            )

        await UserActivity.record(
            self._repository.session,
            user_id=user.id,
            event_type=UserActivityType.USERNAME_CHANGE,
            metadata={
                "old_username": previous_username,
                "new_username": new_username,
            },
            commit=True,
        )

        return UserResponse.model_validate(updated)

    async def list_activity(
        self,
        user_id: uuid.UUID,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> UserActivityListResponse:
        """Return recent activity for the signed-in user, newest first."""

        safe_limit = max(1, min(limit, 100))
        safe_offset = max(0, offset)
        rows = await UserActivity.list_for_user(
            self._repository.session,
            user_id,
            limit=safe_limit,
            offset=safe_offset,
        )
        total = await UserActivity.count_for_user(
            self._repository.session,
            user_id,
        )
        items = [
            UserActivityItem(
                id=row.id,
                event_type=row.event_type,
                metadata=row.metadata_,
                ip_address=row.ip_address,
                user_agent=row.user_agent,
                browser_label=(
                    format_user_agent(row.user_agent)
                    if row.user_agent
                    else None
                ),
                created_at=row.created_at,
            )
            for row in rows
        ]

        return UserActivityListResponse(
            items=items,
            total=total,
            limit=safe_limit,
            offset=safe_offset,
        )
