"""Authentication application service."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

from app.config import settings
from app.models.credentials import UserCredential
from app.models.refresh_token import RefreshToken
from app.repositories.refresh_token import RefreshTokenRepository
from app.repositories.user import UserRepository
from app.schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    UserResponse,
)
from app.schemas.user_bio import UserBioResponse, UserBioUpdateRequest
from app.services.email import EmailService
from app.utils.email_verification import (
    AsyncKeyValueStore,
    consume_verification_token,
    generate_verification_token,
    get_resend_cooldown_remaining,
    store_verification_token,
)
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
        """

        fields_set = set(payload.model_fields_set)
        bio = await self._repository.upsert_bio(
            user.id,
            full_name=payload.full_name,
            date_of_birth=payload.date_of_birth,
            country=payload.country,
            gender=payload.gender,
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

        if issued_at.astimezone(timezone.utc) < changed_at:
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
    ) -> tuple[str, str]:
        """Mint access + refresh JWTs and allowlist the refresh token.

        Each call creates a new independent session. Other active refresh
        tokens for the same user (other browsers/devices) remain valid.

        Args:
            user: Authenticated public profile.
            remember_me: Persist the refresh cookie across browser restarts.
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

        Args:
            user_id: Account whose sessions must end.

        Returns:
            Number of allowlist rows revoked.
        """

        return await self._refresh_tokens.revoke_all_for_user(user_id)

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
        await self.revoke_all_refresh_tokens(user.id)

    async def request_email_verification(
        self,
        user: UserResponse,
        *,
        redis: AsyncKeyValueStore,
        email_service: EmailService,
    ) -> None:
        """Issue a short-lived verification link and email it to ``user``.

        Args:
            user: Authenticated caller.
            redis: Redis client for the hashed token allowlist.
            email_service: Resend-backed mailer.

        Raises:
            HTTPException: 400 when already verified; 429 when the resend
                cooldown is active; 503 when email is not configured.
        """

        if user.email_verified:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is already verified.",
            )

        cooldown_remaining = await get_resend_cooldown_remaining(
            redis,
            user.id,
        )

        if cooldown_remaining > 0:
            minutes = max(1, (cooldown_remaining + 59) // 60)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    "Please wait before requesting another verification "
                    f"email. Try again in about {minutes} minute"
                    f"{'s' if minutes != 1 else ''}."
                ),
                headers={"Retry-After": str(cooldown_remaining)},
            )

        raw_token = generate_verification_token()
        ttl_seconds = max(
            60,
            settings.email_verification_expire_minutes * 60,
        )
        cooldown_seconds = max(
            0,
            settings.email_verification_resend_cooldown_minutes * 60,
        )
        await store_verification_token(
            redis,
            user_id=user.id,
            raw_token=raw_token,
            ttl_seconds=ttl_seconds,
            cooldown_seconds=cooldown_seconds,
        )

        base = settings.frontend_base_url.rstrip("/")
        verify_url = f"{base}/verify-email?token={raw_token}"
        minutes = settings.email_verification_expire_minutes
        html = (
            "<div style=\"font-family:sans-serif;padding:24px;\">"
            f"<h1>Verify your email</h1>"
            f"<p>Hi {user.username},</p>"
            "<p>Confirm your Velvet account email by opening this link "
            f"(expires in {minutes} minutes):</p>"
            f'<p><a href="{verify_url}">{verify_url}</a></p>'
            "<p>If you did not create an account, ignore this message.</p>"
            "</div>"
        )
        text = (
            f"Verify your Velvet email (expires in {minutes} minutes):\n"
            f"{verify_url}\n"
        )
        email_service.send_email(
            to=[user.email],
            subject="Verify your Velvet email",
            html=html,
            text=text,
        )

    async def confirm_email_verification(
        self,
        raw_token: str,
        *,
        redis: AsyncKeyValueStore,
    ) -> UserResponse:
        """Consume a verification token and mark the account verified.

        Args:
            raw_token: Opaque token from the email link.
            redis: Redis client holding the hashed token.

        Returns:
            Updated public profile.

        Raises:
            HTTPException: 400 when the token is missing, expired, or invalid.
        """

        user_id = await consume_verification_token(redis, raw_token)

        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification link is invalid or has expired.",
            )

        user = await self._repository.mark_email_verified(user_id)

        if user is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification link is invalid or has expired.",
            )

        return UserResponse.model_validate(user)

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
