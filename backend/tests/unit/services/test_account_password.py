"""Unit tests for ``app.services.account_password.AccountPasswordService``."""

from __future__ import annotations

import uuid
from typing import Any, Optional
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException, status

from app.schemas.auth import (
    ChangePasswordConfirmLinkRequest,
    ChangePasswordVerifyRequest,
    UserResponse,
)
from app.services.account_password import AccountPasswordService
from app.utils.password import hash_password
from app.utils.password_change import (
    MAX_PASSWORD_VERIFY_ATTEMPTS,
    hash_token,
    peek_intent_user_id,
    store_form_session,
    store_intent_token,
)
from tests.unit.services.test_auth import (
    FakeRefreshTokenRepository,
    FakeUser,
    FakeUserRepository,
)


class _FakeEmailService:
    """Records outbound messages for password-change assertions."""

    def __init__(self) -> None:
        self.sent: list[dict[str, Any]] = []

    def send_email(
        self,
        *,
        to: list[str],
        subject: str,
        html: str,
        text: str,
    ) -> None:
        self.sent.append(
            {
                "to": to,
                "subject": subject,
                "html": html,
                "text": text,
            },
        )


class _ChangePasswordRedis:
    """Minimal async key-value store for password-change service tests."""

    def __init__(self) -> None:
        self.values: dict[str, str] = {}
        self.expiries: dict[str, int] = {}

    async def set(
        self,
        name: str,
        value: str,
        ex: Optional[int] = None,
        nx: Optional[bool] = None,
    ) -> object:
        if nx and name in self.values:
            return None

        self.values[name] = value

        if ex is not None:
            self.expiries[name] = ex

        return True

    async def get(self, name: str) -> Optional[str]:
        return self.values.get(name)

    async def delete(self, *names: str) -> object:
        for name in names:
            self.values.pop(name, None)
            self.expiries.pop(name, None)

        return True

    async def ttl(self, name: str) -> int:
        if name not in self.values:
            return -2

        return self.expiries.get(name, -1)


@pytest.fixture
def repository() -> FakeUserRepository:
    return FakeUserRepository()


@pytest.fixture
def refresh_tokens() -> FakeRefreshTokenRepository:
    return FakeRefreshTokenRepository()


@pytest.fixture
def service(
    repository: FakeUserRepository,
    refresh_tokens: FakeRefreshTokenRepository,
) -> AccountPasswordService:
    return AccountPasswordService(
        repository,  # type: ignore[arg-type]
        refresh_tokens,  # type: ignore[arg-type]
    )


def _active_user() -> FakeUser:
    return FakeUser(
        id=uuid.uuid4(),
        username="alice",
        email="alice@example.com",
        display_name="Alice",
        email_verified=True,
    )


@pytest.mark.asyncio
async def test_request_change_password_link_sends_email(
    service: AccountPasswordService,
    repository: FakeUserRepository,
) -> None:
    """Intent link is emailed to the account address."""

    user = _active_user()
    repository.by_username["alice"] = user
    repository.by_email["alice@example.com"] = user
    profile = UserResponse.model_validate(user)
    redis = _ChangePasswordRedis()
    mailer = _FakeEmailService()

    with patch(
        "app.services.account_password.generate_token",
        return_value="intent-token-value-123456",
    ):
        result = await service.request_change_password_link(
            profile,
            redis=redis,
            email_service=mailer,  # type: ignore[arg-type]
        )

    assert result.success is True
    assert len(mailer.sent) == 1
    assert mailer.sent[0]["to"] == ["alice@example.com"]
    assert "Change your Velvet password" in mailer.sent[0]["subject"]
    assert (
        "change-password?token=intent-token-value-123456"
        in mailer.sent[0]["html"]
    )
    assert (
        await peek_intent_user_id(redis, "intent-token-value-123456")
        == user.id
    )


@pytest.mark.asyncio
async def test_request_change_password_link_respects_cooldown(
    service: AccountPasswordService,
    repository: FakeUserRepository,
) -> None:
    """Second request while cooldown is active yields HTTP 429."""

    user = _active_user()
    repository.by_username["alice"] = user
    profile = UserResponse.model_validate(user)
    redis = _ChangePasswordRedis()
    mailer = _FakeEmailService()

    await service.request_change_password_link(
        profile,
        redis=redis,
        email_service=mailer,  # type: ignore[arg-type]
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.request_change_password_link(
            profile,
            redis=redis,
            email_service=mailer,  # type: ignore[arg-type]
        )

    assert exc_info.value.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert len(mailer.sent) == 1


@pytest.mark.asyncio
async def test_open_change_password_form_returns_form_and_xsrf(
    service: AccountPasswordService,
    repository: FakeUserRepository,
) -> None:
    """Valid intent token yields form_id and xsrf_token."""

    user = _active_user()
    repository.by_username["alice"] = user
    redis = _ChangePasswordRedis()
    raw_token = "intent-token-value-123456"

    await store_intent_token(
        redis,
        user_id=user.id,
        raw_token=raw_token,
        ttl_seconds=600,
        cooldown_seconds=0,
    )

    with (
        patch(
            "app.services.account_password.generate_form_id",
            return_value="form-id-abc12345",
        ),
        patch(
            "app.services.account_password.generate_xsrf_token",
            return_value="xsrf-token-value-123456",
        ),
    ):
        result = await service.open_change_password_form(
            raw_token, redis=redis
        )

    assert result.form_id == "form-id-abc12345"
    assert result.xsrf_token == "xsrf-token-value-123456"


@pytest.mark.asyncio
async def test_open_change_password_form_rejects_invalid_token(
    service: AccountPasswordService,
) -> None:
    """Unknown intent token yields HTTP 400."""

    redis = _ChangePasswordRedis()

    with pytest.raises(HTTPException) as exc_info:
        await service.open_change_password_form(
            "unknown-token-value-xx",
            redis=redis,
        )

    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.asyncio
async def test_verify_current_password_success(
    service: AccountPasswordService,
    repository: FakeUserRepository,
) -> None:
    """Correct current password marks the form session verified."""

    user = _active_user()
    repository.by_username["alice"] = user
    redis = _ChangePasswordRedis()
    raw_token = "intent-token-value-123456"
    form_id = "form-id-abc12345"
    xsrf_token = "xsrf-token-value-123456"
    current_password = "Admin123456&"

    await store_intent_token(
        redis,
        user_id=user.id,
        raw_token=raw_token,
        ttl_seconds=600,
        cooldown_seconds=0,
    )
    await store_form_session(
        redis,
        form_id=form_id,
        user_id=user.id,
        intent_token_hash=hash_token(raw_token),
        xsrf_token=xsrf_token,
        ttl_seconds=600,
    )

    credential = type(
        "Cred",
        (),
        {"password_hash": hash_password(current_password)},
    )()

    with patch(
        "app.services.account_password.UserCredential.get_by_user_id",
        new=AsyncMock(return_value=credential),
    ):
        result = await service.verify_current_password(
            ChangePasswordVerifyRequest(
                token=raw_token,
                form_id=form_id,
                xsrf_token=xsrf_token,
                current_password=current_password,
            ),
            redis=redis,
        )

    assert result.success is True
    assert result.locked_out is False
    assert result.attempts_remaining == MAX_PASSWORD_VERIFY_ATTEMPTS


@pytest.mark.asyncio
async def test_verify_current_password_wrong_decrements_attempts(
    service: AccountPasswordService,
    repository: FakeUserRepository,
) -> None:
    """Incorrect password reduces attempts_remaining without lockout."""

    user = _active_user()
    repository.by_username["alice"] = user
    redis = _ChangePasswordRedis()
    raw_token = "intent-token-value-123456"
    form_id = "form-id-abc12345"
    xsrf_token = "xsrf-token-value-123456"

    await store_intent_token(
        redis,
        user_id=user.id,
        raw_token=raw_token,
        ttl_seconds=600,
        cooldown_seconds=0,
    )
    await store_form_session(
        redis,
        form_id=form_id,
        user_id=user.id,
        intent_token_hash=hash_token(raw_token),
        xsrf_token=xsrf_token,
        ttl_seconds=600,
    )

    credential = type(
        "Cred",
        (),
        {"password_hash": hash_password("CorrectPassword1!")},
    )()

    with patch(
        "app.services.account_password.UserCredential.get_by_user_id",
        new=AsyncMock(return_value=credential),
    ):
        result = await service.verify_current_password(
            ChangePasswordVerifyRequest(
                token=raw_token,
                form_id=form_id,
                xsrf_token=xsrf_token,
                current_password="WrongPassword1!",
            ),
            redis=redis,
        )

    assert result.success is False
    assert result.locked_out is False
    assert result.attempts_remaining == MAX_PASSWORD_VERIFY_ATTEMPTS - 1


@pytest.mark.asyncio
async def test_verify_current_password_lockout_revokes_sessions(
    service: AccountPasswordService,
    repository: FakeUserRepository,
    refresh_tokens: FakeRefreshTokenRepository,
) -> None:
    """Max failed attempts invalidate the link and revoke all sessions."""

    user = _active_user()
    repository.by_username["alice"] = user
    redis = _ChangePasswordRedis()
    raw_token = "intent-token-value-123456"
    form_id = "form-id-abc12345"
    xsrf_token = "xsrf-token-value-123456"

    await store_intent_token(
        redis,
        user_id=user.id,
        raw_token=raw_token,
        ttl_seconds=600,
        cooldown_seconds=0,
    )
    await store_form_session(
        redis,
        form_id=form_id,
        user_id=user.id,
        intent_token_hash=hash_token(raw_token),
        xsrf_token=xsrf_token,
        ttl_seconds=600,
    )
    await refresh_tokens.issue(
        token_hash="session-hash-1",
        user_id=user.id,
    )

    credential = type(
        "Cred",
        (),
        {"password_hash": hash_password("CorrectPassword1!")},
    )()

    with patch(
        "app.services.account_password.UserCredential.get_by_user_id",
        new=AsyncMock(return_value=credential),
    ):
        for _ in range(MAX_PASSWORD_VERIFY_ATTEMPTS - 1):
            intermediate = await service.verify_current_password(
                ChangePasswordVerifyRequest(
                    token=raw_token,
                    form_id=form_id,
                    xsrf_token=xsrf_token,
                    current_password="WrongPassword1!",
                ),
                redis=redis,
            )
            assert intermediate.locked_out is False

        result = await service.verify_current_password(
            ChangePasswordVerifyRequest(
                token=raw_token,
                form_id=form_id,
                xsrf_token=xsrf_token,
                current_password="WrongPassword1!",
            ),
            redis=redis,
        )

    assert result.success is False
    assert result.locked_out is True
    assert result.attempts_remaining == 0
    assert "session-hash-1" in refresh_tokens.revoked_hashes
    assert await peek_intent_user_id(redis, raw_token) is None


@pytest.mark.asyncio
async def test_confirm_new_password_updates_and_revokes(
    service: AccountPasswordService,
    repository: FakeUserRepository,
    refresh_tokens: FakeRefreshTokenRepository,
) -> None:
    """Verified session applies new password and signs out all devices."""

    user = _active_user()
    repository.by_username["alice"] = user
    redis = _ChangePasswordRedis()
    raw_token = "intent-token-value-123456"
    form_id = "form-id-abc12345"
    xsrf_token = "xsrf-token-value-123456"
    current_password = "OldPassword1!"
    new_password = "NewPassword2!"

    await store_intent_token(
        redis,
        user_id=user.id,
        raw_token=raw_token,
        ttl_seconds=600,
        cooldown_seconds=0,
    )
    await store_form_session(
        redis,
        form_id=form_id,
        user_id=user.id,
        intent_token_hash=hash_token(raw_token),
        xsrf_token=xsrf_token,
        ttl_seconds=600,
    )
    await refresh_tokens.issue(
        token_hash="session-hash-1",
        user_id=user.id,
    )

    credential = type(
        "Cred",
        (),
        {"password_hash": hash_password(current_password)},
    )()

    with patch(
        "app.services.account_password.UserCredential.get_by_user_id",
        new=AsyncMock(return_value=credential),
    ):
        verify = await service.verify_current_password(
            ChangePasswordVerifyRequest(
                token=raw_token,
                form_id=form_id,
                xsrf_token=xsrf_token,
                current_password=current_password,
            ),
            redis=redis,
        )
        assert verify.success is True

        result = await service.confirm_new_password(
            ChangePasswordConfirmLinkRequest(
                token=raw_token,
                form_id=form_id,
                xsrf_token=xsrf_token,
                new_password=new_password,
            ),
            redis=redis,
        )

    assert result.success is True
    assert len(repository.update_password_calls) == 1
    assert repository.update_password_calls[0]["user_id"] == user.id
    assert "session-hash-1" in refresh_tokens.revoked_hashes


@pytest.mark.asyncio
async def test_confirm_new_password_requires_prior_verify(
    service: AccountPasswordService,
    repository: FakeUserRepository,
) -> None:
    """Confirm without password_verified yields HTTP 400."""

    user = _active_user()
    repository.by_username["alice"] = user
    redis = _ChangePasswordRedis()
    raw_token = "intent-token-value-123456"
    form_id = "form-id-abc12345"
    xsrf_token = "xsrf-token-value-123456"

    await store_intent_token(
        redis,
        user_id=user.id,
        raw_token=raw_token,
        ttl_seconds=600,
        cooldown_seconds=0,
    )
    await store_form_session(
        redis,
        form_id=form_id,
        user_id=user.id,
        intent_token_hash=hash_token(raw_token),
        xsrf_token=xsrf_token,
        ttl_seconds=600,
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.confirm_new_password(
            ChangePasswordConfirmLinkRequest(
                token=raw_token,
                form_id=form_id,
                xsrf_token=xsrf_token,
                new_password="NewPassword2!",
            ),
            redis=redis,
        )

    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
    assert "current password" in str(exc_info.value.detail).lower()
