"""Account email verification and change-email application service."""

from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

from app.config import settings
from app.repositories.user import UserRepository
from app.schemas.auth import (
    ChangeEmailConfirmRequest,
    ChangeEmailConfirmResponse,
    ChangeEmailFormSessionResponse,
    ChangeEmailRequestLinkResponse,
    UserResponse,
)
from app.services.email import EmailService
from app.utils.email_change import (
    consume_intent_token,
    consume_pending_email_change,
    delete_form_session,
    generate_form_id,
    generate_token,
    generate_xsrf_token,
    get_intent_cooldown_remaining,
    hash_token,
    load_form_session,
    peek_intent_user_id,
    store_form_session,
    store_intent_token,
    store_pending_email_change,
)
from app.utils.email_verification import (
    AsyncKeyValueStore,
    consume_verification_token,
    generate_verification_token,
    get_resend_cooldown_remaining,
    store_verification_token,
)


class AccountEmailService:
    """Verify and change the account email address."""

    def __init__(self, repository: UserRepository) -> None:
        self._repository = repository

    @staticmethod
    def _mask_email(email: str) -> str:
        local, _, domain = email.partition("@")

        if not domain:
            return "***"

        if len(local) <= 2:
            masked_local = "*" * len(local)
        else:
            masked_local = f"{local[0]}***{local[-1]}"

        return f"{masked_local}@{domain}"

    async def request_email_verification(
        self,
        user: UserResponse,
        *,
        redis: AsyncKeyValueStore,
        email_service: EmailService,
    ) -> None:
        """Issue a short-lived verification link and email it to ``user``."""

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
            '<div style="font-family:sans-serif;padding:24px;">'
            "<h1>Verify your email</h1>"
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
        """Consume a verification token and mark the account verified."""

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

    async def request_change_email_link(
        self,
        user: UserResponse,
        *,
        redis: AsyncKeyValueStore,
        email_service: EmailService,
    ) -> ChangeEmailRequestLinkResponse:
        """Email a short-lived change-email link to the current address."""

        cooldown_remaining = await get_intent_cooldown_remaining(
            redis, user.id
        )

        if cooldown_remaining > 0:
            minutes = max(1, (cooldown_remaining + 59) // 60)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    "Please wait before requesting another change-email "
                    f"link. Try again in about {minutes} minute"
                    f"{'s' if minutes != 1 else ''}."
                ),
                headers={"Retry-After": str(cooldown_remaining)},
            )

        raw_token = generate_token()
        ttl_seconds = max(
            60,
            settings.email_verification_expire_minutes * 60,
        )
        cooldown_seconds = max(
            0,
            settings.email_verification_resend_cooldown_minutes * 60,
        )
        await store_intent_token(
            redis,
            user_id=user.id,
            raw_token=raw_token,
            ttl_seconds=ttl_seconds,
            cooldown_seconds=cooldown_seconds,
        )

        base = settings.frontend_base_url.rstrip("/")
        change_url = f"{base}/change-email?token={raw_token}"
        minutes = settings.email_verification_expire_minutes
        html = (
            '<div style="font-family:sans-serif;padding:24px;">'
            "<h1>Change your email</h1>"
            f"<p>Hi {user.username},</p>"
            "<p>We received a request to change the email on your Velvet "
            f"account. Open this link (expires in {minutes} minutes):</p>"
            f'<p><a href="{change_url}">{change_url}</a></p>'
            "<p>If you did not request this, ignore this message.</p>"
            "</div>"
        )
        text = (
            f"Change your Velvet email (expires in {minutes} minutes):\n"
            f"{change_url}\n"
        )
        email_service.send_email(
            to=[user.email],
            subject="Change your Velvet email",
            html=html,
            text=text,
        )

        return ChangeEmailRequestLinkResponse(
            success=True,
            detail=(
                "A change-email link was sent to your current email address."
            ),
        )

    async def open_change_email_form(
        self,
        raw_token: str,
        *,
        redis: AsyncKeyValueStore,
    ) -> ChangeEmailFormSessionResponse:
        """Issue form_id + XSRF for a valid intent token."""

        user_id = await peek_intent_user_id(redis, raw_token)

        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Change-email link is invalid or has expired.",
            )

        user = await self._repository.get_by_id(user_id)

        if user is None or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Change-email link is invalid or has expired.",
            )

        form_id = generate_form_id()
        xsrf_token = generate_xsrf_token()
        ttl_seconds = max(
            60,
            settings.email_verification_expire_minutes * 60,
        )
        await store_form_session(
            redis,
            form_id=form_id,
            user_id=user_id,
            intent_token_hash=hash_token(raw_token.strip()),
            xsrf_token=xsrf_token,
            ttl_seconds=ttl_seconds,
        )

        return ChangeEmailFormSessionResponse(
            form_id=form_id,
            xsrf_token=xsrf_token,
            email_verified=user.email_verified,
            current_email_masked=self._mask_email(user.email),
        )

    async def confirm_change_email(
        self,
        payload: ChangeEmailConfirmRequest,
        *,
        redis: AsyncKeyValueStore,
        email_service: EmailService,
    ) -> ChangeEmailConfirmResponse:
        """Apply or stage an email change after form + intent checks."""

        session = await load_form_session(redis, payload.form_id)

        if session is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Change-email form session is invalid or has expired.",
            )

        if session["xsrf_hash"] != hash_token(payload.xsrf_token):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid form security token.",
            )

        intent_hash = hash_token(payload.token.strip())

        if session["intent_token_hash"] != intent_hash:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Change-email link does not match this form.",
            )

        user_id = await consume_intent_token(redis, payload.token)

        if user_id is None or str(user_id) != session["user_id"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Change-email link is invalid or has expired.",
            )

        await delete_form_session(redis, payload.form_id)

        user = await self._repository.get_by_id(user_id)

        if user is None or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Change-email link is invalid or has expired.",
            )

        new_email = payload.new_email

        if new_email.lower() == user.email.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New email must be different from the current email.",
            )

        existing = await self._repository.get_by_email(new_email)

        if existing is not None and existing.id != user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="That email address is already in use.",
            )

        if not user.email_verified:
            try:
                updated = await self._repository.update_email(
                    user.id,
                    email=new_email,
                    email_verified=False,
                )
            except IntegrityError as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="That email address is already in use.",
                ) from exc

            if updated is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Unable to update email.",
                )

            return ChangeEmailConfirmResponse(
                success=True,
                detail="Email updated. Verify the new address when ready.",
                requires_new_email_verification=False,
                user=UserResponse.model_validate(updated),
            )

        raw_pending = generate_token()
        ttl_seconds = max(
            60,
            settings.email_verification_expire_minutes * 60,
        )
        await store_pending_email_change(
            redis,
            user_id=user.id,
            new_email=new_email,
            raw_token=raw_pending,
            ttl_seconds=ttl_seconds,
        )

        base = settings.frontend_base_url.rstrip("/")
        verify_url = f"{base}/verify-email-change?token={raw_pending}"
        minutes = settings.email_verification_expire_minutes
        html = (
            '<div style="font-family:sans-serif;padding:24px;">'
            "<h1>Confirm your new email</h1>"
            f"<p>Hi {user.username},</p>"
            "<p>Confirm this address as your new Velvet account email "
            f"(expires in {minutes} minutes):</p>"
            f'<p><a href="{verify_url}">{verify_url}</a></p>'
            "<p>If you did not request this, ignore this message.</p>"
            "</div>"
        )
        text = (
            f"Confirm your new Velvet email (expires in {minutes} minutes):\n"
            f"{verify_url}\n"
        )
        email_service.send_email(
            to=[new_email],
            subject="Confirm your new Velvet email",
            html=html,
            text=text,
        )

        return ChangeEmailConfirmResponse(
            success=True,
            detail=(
                "Check the new inbox and open the confirmation link to "
                "finish updating your email."
            ),
            requires_new_email_verification=True,
            user=None,
        )

    async def confirm_new_email_change(
        self,
        raw_token: str,
        *,
        redis: AsyncKeyValueStore,
    ) -> UserResponse:
        """Finalize a verified-account email change from the new inbox."""

        pending = await consume_pending_email_change(redis, raw_token)

        if pending is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email-change link is invalid or has expired.",
            )

        user_id, new_email = pending
        existing = await self._repository.get_by_email(new_email)

        if existing is not None and existing.id != user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="That email address is already in use.",
            )

        try:
            updated = await self._repository.update_email(
                user_id,
                email=new_email,
                email_verified=True,
            )
        except IntegrityError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="That email address is already in use.",
            ) from exc

        if updated is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email-change link is invalid or has expired.",
            )

        return UserResponse.model_validate(updated)
