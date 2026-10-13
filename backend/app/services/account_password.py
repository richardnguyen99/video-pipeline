"""Authenticated password-change via emailed temporary link."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import HTTPException, status

from app.config import settings
from app.models.credentials import UserCredential
from app.repositories.refresh_token import RefreshTokenRepository
from app.repositories.user import UserRepository
from app.schemas.auth import (
    ChangePasswordConfirmLinkRequest,
    ChangePasswordConfirmLinkResponse,
    ChangePasswordFormSessionResponse,
    ChangePasswordRequestLinkResponse,
    ChangePasswordVerifyRequest,
    ChangePasswordVerifyResponse,
    UserResponse,
)
from app.services.email import EmailService
from app.utils.password import (
    PASSWORD_ALGORITHM,
    hash_password,
    verify_password,
)
from app.utils.password_change import (
    MAX_PASSWORD_VERIFY_ATTEMPTS,
    AsyncKeyValueStore,
    consume_intent_token,
    delete_form_session,
    generate_form_id,
    generate_token,
    generate_xsrf_token,
    get_intent_cooldown_remaining,
    hash_token,
    load_form_session,
    peek_intent_user_id,
    save_form_session,
    store_form_session,
    store_intent_token,
)


class AccountPasswordService:
    """Issue and complete password changes through a secure email link."""

    def __init__(
        self,
        repository: UserRepository,
        refresh_tokens: RefreshTokenRepository,
    ) -> None:
        self._repository = repository
        self._refresh_tokens = refresh_tokens

    async def request_change_password_link(
        self,
        user: UserResponse,
        *,
        redis: AsyncKeyValueStore,
        email_service: EmailService,
    ) -> ChangePasswordRequestLinkResponse:
        """Email a short-lived password-change link to the account address."""

        cooldown_remaining = await get_intent_cooldown_remaining(
            redis, user.id
        )

        if cooldown_remaining > 0:
            minutes = max(1, (cooldown_remaining + 59) // 60)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    "Please wait before requesting another password-change "
                    f"link. Try again in about {minutes} minute"
                    f"{'s' if minutes != 1 else ''}."
                ),
                headers={"Retry-After": str(cooldown_remaining)},
            )

        raw_token = generate_token()
        ttl_seconds = max(60, settings.password_reset_expire_minutes * 60)
        cooldown_seconds = max(
            0,
            settings.password_reset_resend_cooldown_minutes * 60,
        )
        await store_intent_token(
            redis,
            user_id=user.id,
            raw_token=raw_token,
            ttl_seconds=ttl_seconds,
            cooldown_seconds=cooldown_seconds,
        )

        base = settings.frontend_base_url.rstrip("/")
        change_url = f"{base}/change-password?token={raw_token}"
        minutes = settings.password_reset_expire_minutes
        html = (
            '<div style="font-family:sans-serif;padding:24px;">'
            "<h1>Change your password</h1>"
            f"<p>Hi {user.username},</p>"
            "<p>We received a request to change the password on your Velvet "
            f"account. Open this link (expires in {minutes} minutes):</p>"
            f'<p><a href="{change_url}">{change_url}</a></p>'
            "<p>If you did not request this, ignore this message.</p>"
            "</div>"
        )
        text = (
            f"Change your Velvet password (expires in {minutes} minutes):\n"
            f"{change_url}\n"
        )
        email_service.send_email(
            to=[user.email],
            subject="Change your Velvet password",
            html=html,
            text=text,
        )

        return ChangePasswordRequestLinkResponse(
            success=True,
            detail="A password-change link was sent to your email address.",
        )

    async def open_change_password_form(
        self,
        raw_token: str,
        *,
        redis: AsyncKeyValueStore,
    ) -> ChangePasswordFormSessionResponse:
        """Issue form_id + XSRF for a valid password-change intent token."""

        user_id = await peek_intent_user_id(redis, raw_token)

        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password-change link is invalid or has expired.",
            )

        user = await self._repository.get_by_id(user_id)

        if user is None or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password-change link is invalid or has expired.",
            )

        form_id = generate_form_id()
        xsrf_token = generate_xsrf_token()
        ttl_seconds = max(60, settings.password_reset_expire_minutes * 60)
        await store_form_session(
            redis,
            form_id=form_id,
            user_id=user_id,
            intent_token_hash=hash_token(raw_token.strip()),
            xsrf_token=xsrf_token,
            ttl_seconds=ttl_seconds,
        )

        return ChangePasswordFormSessionResponse(
            form_id=form_id,
            xsrf_token=xsrf_token,
        )

    async def verify_current_password(
        self,
        payload: ChangePasswordVerifyRequest,
        *,
        redis: AsyncKeyValueStore,
    ) -> ChangePasswordVerifyResponse:
        """Confirm the current password; lock out after too many failures."""

        session = await self._load_valid_session(
            redis,
            form_id=payload.form_id,
            xsrf_token=payload.xsrf_token,
            raw_token=payload.token,
        )
        user_id_str = str(session["user_id"])
        user = await self._repository.get_by_id(uuid.UUID(user_id_str))

        if user is None or not user.is_active:
            await self._invalidate_flow(redis, payload.form_id, payload.token)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password-change link is invalid or has expired.",
            )

        credential = await UserCredential.get_by_user_id(
            self._repository.session,
            user.id,
        )

        if credential is None:
            await self._invalidate_flow(redis, payload.form_id, payload.token)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password-change link is invalid or has expired.",
            )

        if verify_password(payload.current_password, credential.password_hash):
            session["password_verified"] = True
            session["attempts"] = 0
            ttl_seconds = max(60, settings.password_reset_expire_minutes * 60)
            await save_form_session(
                redis,
                payload.form_id,
                session,
                ttl_seconds=ttl_seconds,
            )

            return ChangePasswordVerifyResponse(
                success=True,
                detail="Current password confirmed.",
                attempts_remaining=MAX_PASSWORD_VERIFY_ATTEMPTS,
                locked_out=False,
            )

        attempts = int(session.get("attempts", 0)) + 1
        session["attempts"] = attempts
        remaining = max(0, MAX_PASSWORD_VERIFY_ATTEMPTS - attempts)

        if attempts >= MAX_PASSWORD_VERIFY_ATTEMPTS:
            await self._invalidate_flow(redis, payload.form_id, payload.token)
            await self._refresh_tokens.revoke_all_for_user(user.id)

            return ChangePasswordVerifyResponse(
                success=False,
                detail=(
                    "Too many incorrect attempts. This link is no longer "
                    "valid and all sessions have been signed out."
                ),
                attempts_remaining=0,
                locked_out=True,
            )

        ttl_seconds = max(60, settings.password_reset_expire_minutes * 60)
        await save_form_session(
            redis,
            payload.form_id,
            session,
            ttl_seconds=ttl_seconds,
        )

        return ChangePasswordVerifyResponse(
            success=False,
            detail=(
                "Current password is incorrect. "
                f"{remaining} attempt{'s' if remaining != 1 else ''} remaining."
            ),
            attempts_remaining=remaining,
            locked_out=False,
        )

    async def confirm_new_password(
        self,
        payload: ChangePasswordConfirmLinkRequest,
        *,
        redis: AsyncKeyValueStore,
    ) -> ChangePasswordConfirmLinkResponse:
        """Apply a new password after current-password verification."""

        session = await self._load_valid_session(
            redis,
            form_id=payload.form_id,
            xsrf_token=payload.xsrf_token,
            raw_token=payload.token,
        )

        if not session.get("password_verified"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Confirm your current password before setting a new one.",
            )

        user_id = await consume_intent_token(redis, payload.token)

        if user_id is None or str(user_id) != str(session["user_id"]):
            await delete_form_session(redis, payload.form_id)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password-change link is invalid or has expired.",
            )

        await delete_form_session(redis, payload.form_id)

        credential = await UserCredential.get_by_user_id(
            self._repository.session,
            user_id,
        )

        if credential is not None and verify_password(
            payload.new_password,
            credential.password_hash,
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password must be different from the current password.",
            )

        new_hash = hash_password(payload.new_password)
        await self._repository.update_password(
            user_id,
            password_hash=new_hash,
            password_algorithm=PASSWORD_ALGORITHM,
        )
        await self._refresh_tokens.revoke_all_for_user(user_id)

        return ChangePasswordConfirmLinkResponse(
            success=True,
            detail="Password updated. Sign in again with your new password.",
        )

    async def _load_valid_session(
        self,
        redis: AsyncKeyValueStore,
        *,
        form_id: str,
        xsrf_token: str,
        raw_token: str,
    ) -> dict[str, Any]:
        session = await load_form_session(redis, form_id)

        if session is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password-change form session is invalid or has expired.",
            )

        if session["xsrf_hash"] != hash_token(xsrf_token):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid form security token.",
            )

        if session["intent_token_hash"] != hash_token(raw_token.strip()):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password-change link does not match this form.",
            )

        return session

    async def _invalidate_flow(
        self,
        redis: AsyncKeyValueStore,
        form_id: str,
        raw_token: str,
    ) -> None:
        await delete_form_session(redis, form_id)
        await consume_intent_token(redis, raw_token)
