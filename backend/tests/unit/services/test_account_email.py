"""Unit tests for ``app.services.account_email.AccountEmailService``."""

from __future__ import annotations

import uuid
from typing import Any, Optional
from unittest.mock import patch

import pytest
from fastapi import HTTPException, status

from app.models.user_activity import UserActivity, UserActivityType
from app.schemas.auth import ChangeEmailConfirmRequest, UserResponse
from app.services.account_email import AccountEmailService
from app.utils.email_change import (
    generate_form_id,
    generate_xsrf_token,
    hash_token,
    peek_intent_user_id,
    store_form_session,
    store_intent_token,
    store_pending_email_change,
)
from tests.unit.services.test_auth import FakeUser, FakeUserRepository


class _FakeEmailService:
    """Records outbound messages for change-email assertions."""

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


class _ChangeEmailRedis:
    """Minimal async key-value store for change-email service tests."""

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
def service(repository: FakeUserRepository) -> AccountEmailService:
    return AccountEmailService(repository)  # type: ignore[arg-type]


@pytest.mark.asyncio
async def test_request_change_email_link_sends_to_current_address(
    service: AccountEmailService,
    repository: FakeUserRepository,
) -> None:
    """Intent link is emailed to the current account address."""

    user = FakeUser(
        id=uuid.uuid4(),
        username="alice",
        email="alice@example.com",
        display_name="Alice",
        email_verified=True,
    )
    repository.by_username["alice"] = user
    repository.by_email["alice@example.com"] = user
    profile = UserResponse.model_validate(user)
    redis = _ChangeEmailRedis()
    mailer = _FakeEmailService()

    with patch(
        "app.services.account_email.generate_token",
        return_value="intent-token-value-123456",
    ):
        result = await service.request_change_email_link(
            profile,
            redis=redis,
            email_service=mailer,  # type: ignore[arg-type]
        )

    assert result.success is True
    assert len(mailer.sent) == 1
    assert mailer.sent[0]["to"] == ["alice@example.com"]
    assert (
        "change-email?token=intent-token-value-123456"
        in mailer.sent[0]["html"]
    )
    assert (
        await peek_intent_user_id(redis, "intent-token-value-123456")
        == user.id
    )


@pytest.mark.asyncio
async def test_request_change_email_link_respects_cooldown(
    service: AccountEmailService,
    repository: FakeUserRepository,
) -> None:
    """Second request while cooldown is active yields HTTP 429."""

    user = FakeUser(
        id=uuid.uuid4(),
        username="alice",
        email="alice@example.com",
        display_name="Alice",
    )
    repository.by_username["alice"] = user
    profile = UserResponse.model_validate(user)
    redis = _ChangeEmailRedis()
    mailer = _FakeEmailService()

    await service.request_change_email_link(
        profile,
        redis=redis,
        email_service=mailer,  # type: ignore[arg-type]
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.request_change_email_link(
            profile,
            redis=redis,
            email_service=mailer,  # type: ignore[arg-type]
        )

    assert exc_info.value.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert len(mailer.sent) == 1


@pytest.mark.asyncio
async def test_open_change_email_form_returns_form_and_xsrf(
    service: AccountEmailService,
    repository: FakeUserRepository,
) -> None:
    """Valid intent token yields form_id, xsrf, and masked email."""

    user = FakeUser(
        id=uuid.uuid4(),
        username="alice",
        email="alice@example.com",
        display_name="Alice",
        email_verified=False,
    )
    repository.by_username["alice"] = user
    repository.by_email["alice@example.com"] = user
    redis = _ChangeEmailRedis()
    raw = "intent-open-form-token-abcdef"

    await store_intent_token(
        redis,
        user_id=user.id,
        raw_token=raw,
        ttl_seconds=900,
        cooldown_seconds=0,
    )

    session = await service.open_change_email_form(raw, redis=redis)

    assert session.form_id
    assert session.xsrf_token
    assert session.email_verified is False
    assert "***" in session.current_email_masked
    assert "@example.com" in session.current_email_masked


@pytest.mark.asyncio
async def test_confirm_change_email_updates_when_unverified(
    service: AccountEmailService,
    repository: FakeUserRepository,
) -> None:
    """Unverified accounts update email immediately on form submit."""

    user = FakeUser(
        id=uuid.uuid4(),
        username="alice",
        email="alice@example.com",
        display_name="Alice",
        email_verified=False,
    )
    repository.by_username["alice"] = user
    repository.by_email["alice@example.com"] = user
    redis = _ChangeEmailRedis()
    mailer = _FakeEmailService()
    raw = "intent-confirm-unverified-token-xyz"
    form_id = generate_form_id()
    xsrf = generate_xsrf_token()

    await store_intent_token(
        redis,
        user_id=user.id,
        raw_token=raw,
        ttl_seconds=900,
        cooldown_seconds=0,
    )
    await store_form_session(
        redis,
        form_id=form_id,
        user_id=user.id,
        intent_token_hash=hash_token(raw),
        xsrf_token=xsrf,
        ttl_seconds=900,
    )

    payload = ChangeEmailConfirmRequest(
        token=raw,
        form_id=form_id,
        xsrf_token=xsrf,
        new_email="new-alice@example.com",
    )
    result = await service.confirm_change_email(
        payload,
        redis=redis,
        email_service=mailer,  # type: ignore[arg-type]
    )

    assert result.requires_new_email_verification is False
    assert result.user is not None
    assert result.user.email == "new-alice@example.com"
    assert result.user.email_verified is False
    assert user.email == "new-alice@example.com"
    assert mailer.sent == []

    activities = [
        row
        for row in repository.session.added
        if isinstance(row, UserActivity)
    ]

    assert len(activities) == 1
    assert activities[0].event_type == UserActivityType.EMAIL_CHANGE.value
    assert activities[0].metadata_ == {
        "old_email": "alice@example.com",
        "new_email": "new-alice@example.com",
    }


@pytest.mark.asyncio
async def test_confirm_change_email_stages_verify_when_verified(
    service: AccountEmailService,
    repository: FakeUserRepository,
) -> None:
    """Verified accounts email the new address instead of updating yet."""

    user = FakeUser(
        id=uuid.uuid4(),
        username="alice",
        email="alice@example.com",
        display_name="Alice",
        email_verified=True,
    )
    repository.by_username["alice"] = user
    repository.by_email["alice@example.com"] = user
    redis = _ChangeEmailRedis()
    mailer = _FakeEmailService()
    raw = "intent-confirm-verified-token-xyz"
    form_id = generate_form_id()
    xsrf = generate_xsrf_token()

    await store_intent_token(
        redis,
        user_id=user.id,
        raw_token=raw,
        ttl_seconds=900,
        cooldown_seconds=0,
    )
    await store_form_session(
        redis,
        form_id=form_id,
        user_id=user.id,
        intent_token_hash=hash_token(raw),
        xsrf_token=xsrf,
        ttl_seconds=900,
    )

    with patch(
        "app.services.account_email.generate_token",
        return_value="pending-new-email-token-123456",
    ):
        payload = ChangeEmailConfirmRequest(
            token=raw,
            form_id=form_id,
            xsrf_token=xsrf,
            new_email="verified-new@example.com",
        )
        result = await service.confirm_change_email(
            payload,
            redis=redis,
            email_service=mailer,  # type: ignore[arg-type]
        )

    assert result.requires_new_email_verification is True
    assert result.user is None
    assert user.email == "alice@example.com"
    assert len(mailer.sent) == 1
    assert mailer.sent[0]["to"] == ["verified-new@example.com"]
    assert (
        "verify-email-change?token=pending-new-email-token-123456"
        in mailer.sent[0]["html"]
    )


@pytest.mark.asyncio
async def test_confirm_change_email_rejects_bad_xsrf(
    service: AccountEmailService,
    repository: FakeUserRepository,
) -> None:
    """Mismatched XSRF token is rejected before consuming the intent."""

    user = FakeUser(
        id=uuid.uuid4(),
        username="alice",
        email="alice@example.com",
        display_name="Alice",
    )
    repository.by_username["alice"] = user
    redis = _ChangeEmailRedis()
    mailer = _FakeEmailService()
    raw = "intent-bad-xsrf-token-abcdef12"
    form_id = generate_form_id()
    xsrf = generate_xsrf_token()

    await store_intent_token(
        redis,
        user_id=user.id,
        raw_token=raw,
        ttl_seconds=900,
        cooldown_seconds=0,
    )
    await store_form_session(
        redis,
        form_id=form_id,
        user_id=user.id,
        intent_token_hash=hash_token(raw),
        xsrf_token=xsrf,
        ttl_seconds=900,
    )

    payload = ChangeEmailConfirmRequest(
        token=raw,
        form_id=form_id,
        xsrf_token="wrong-xsrf-token-value-zzzz",
        new_email="other@example.com",
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.confirm_change_email(
            payload,
            redis=redis,
            email_service=mailer,  # type: ignore[arg-type]
        )

    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
    assert await peek_intent_user_id(redis, raw) == user.id


@pytest.mark.asyncio
async def test_confirm_new_email_change_applies_verified_email(
    service: AccountEmailService,
    repository: FakeUserRepository,
) -> None:
    """Pending new-email token finalizes the address as verified."""

    user = FakeUser(
        id=uuid.uuid4(),
        username="alice",
        email="alice@example.com",
        display_name="Alice",
        email_verified=True,
    )
    repository.by_username["alice"] = user
    repository.by_email["alice@example.com"] = user
    redis = _ChangeEmailRedis()
    raw = "pending-finalize-token-abcdef12"

    await store_pending_email_change(
        redis,
        user_id=user.id,
        new_email="final@example.com",
        raw_token=raw,
        ttl_seconds=900,
    )

    result = await service.confirm_new_email_change(raw, redis=redis)

    assert result.email == "final@example.com"
    assert result.email_verified is True
    assert user.email == "final@example.com"

    activities = [
        row
        for row in repository.session.added
        if isinstance(row, UserActivity)
    ]

    assert len(activities) == 1
    assert activities[0].event_type == UserActivityType.EMAIL_CHANGE.value
    assert activities[0].metadata_ == {
        "old_email": "alice@example.com",
        "new_email": "final@example.com",
    }
