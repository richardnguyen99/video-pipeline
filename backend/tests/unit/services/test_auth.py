"""Unit tests for ``app.services.auth.AuthService``."""

from __future__ import annotations

import datetime
import uuid
from dataclasses import dataclass, field
from typing import Any, Optional, cast
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

from app.repositories.user import UserRepository
from app.schemas.auth import LoginRequest, RegisterRequest, UserResponse
from app.services.auth import AuthService
from app.utils.password import (
    PASSWORD_ALGORITHM,
    hash_password,
    verify_password,
)


@dataclass
class FakeUser:
    """Minimal user stand-in for registration and login responses."""

    id: uuid.UUID
    username: str
    email: str
    display_name: Optional[str]
    is_active: bool = True
    created_at: datetime.datetime = field(
        default_factory=lambda: datetime.datetime(
            2026,
            1,
            1,
            tzinfo=datetime.timezone.utc,
        ),
    )
    updated_at: datetime.datetime = field(
        default_factory=lambda: datetime.datetime(
            2026,
            1,
            1,
            tzinfo=datetime.timezone.utc,
        ),
    )


@dataclass
class FakeCredential:
    """Minimal credential stand-in for login checks."""

    password_hash: str
    locked_until: Optional[datetime.datetime] = None
    failed_login_attempts: int = 0


@dataclass
class FakeUserRepository:
    """In-memory stand-in for ``UserRepository``."""

    by_username: dict[str, FakeUser] = field(default_factory=dict)
    by_email: dict[str, FakeUser] = field(default_factory=dict)
    create_calls: list[dict[str, Any]] = field(default_factory=list)
    raise_integrity: bool = False
    created_user: Optional[FakeUser] = None
    session: object = field(default_factory=object)
    login_success_calls: list[FakeUser] = field(default_factory=list)
    login_failure_calls: list[FakeUser] = field(default_factory=list)

    async def get_by_username(self, username: str) -> Optional[FakeUser]:
        """Return a user keyed by username, if present."""

        return self.by_username.get(username)

    async def get_by_email(self, email: str) -> Optional[FakeUser]:
        """Return a user keyed by email, if present."""

        return self.by_email.get(email)

    async def create_with_credential(
        self,
        *,
        username: str,
        email: str,
        password_hash: str,
        password_algorithm: str,
        display_name: Optional[str] = None,
    ) -> FakeUser:
        """Record create args and return a synthetic user."""

        self.create_calls.append(
            {
                "username": username,
                "email": email,
                "password_hash": password_hash,
                "password_algorithm": password_algorithm,
                "display_name": display_name,
            },
        )

        if self.raise_integrity:
            raise IntegrityError(
                "duplicate",
                params=None,
                orig=Exception("unique"),
            )

        user = FakeUser(
            id=uuid.UUID("00000000-0000-4000-8000-000000000099"),
            username=username,
            email=email,
            display_name=display_name,
        )
        self.created_user = user

        return user

    async def record_login_success(self, user: FakeUser) -> FakeUser:
        """Record a successful login for assertions."""

        self.login_success_calls.append(user)

        return user

    async def record_login_failure(self, user: FakeUser) -> None:
        """Record a failed login for assertions."""

        self.login_failure_calls.append(user)


@pytest.fixture
def repository() -> FakeUserRepository:
    """Fresh fake repository per test."""

    return FakeUserRepository()


@pytest.fixture
def service(repository: FakeUserRepository) -> AuthService:
    """``AuthService`` wired to the fake repository."""

    return AuthService(repository=cast(UserRepository, repository))


def _valid_payload(**overrides: Any) -> RegisterRequest:
    """Build a valid ``RegisterRequest`` with optional overrides."""

    data: dict[str, Any] = {
        "username": "alice_1",
        "email": "alice@example.com",
        "password": "Secret1!",
        "display_name": "Alice",
    }
    data.update(overrides)

    return RegisterRequest(**data)


@pytest.mark.asyncio
async def test_register_returns_user_response(
    service: AuthService,
    repository: FakeUserRepository,
) -> None:
    """Successful registration returns a public user profile."""

    result = await service.register(_valid_payload())

    assert isinstance(result, UserResponse)
    assert result.username == "alice_1"
    assert result.email == "alice@example.com"
    assert result.display_name == "Alice"
    assert result.is_active is True
    assert len(repository.create_calls) == 1


@pytest.mark.asyncio
async def test_register_hashes_password_with_bcrypt(
    service: AuthService,
    repository: FakeUserRepository,
) -> None:
    """Password is stored as a bcrypt hash, not plaintext."""

    plain = "Secret1!"
    await service.register(_valid_payload(password=plain))

    call = repository.create_calls[0]
    assert call["password_algorithm"] == PASSWORD_ALGORITHM
    assert call["password_hash"] != plain
    assert verify_password(plain, call["password_hash"])


@pytest.mark.asyncio
async def test_register_passes_display_name(
    service: AuthService,
    repository: FakeUserRepository,
) -> None:
    """Optional display name is forwarded to the repository."""

    await service.register(_valid_payload(display_name="Alice Wonder"))

    assert repository.create_calls[0]["display_name"] == "Alice Wonder"


@pytest.mark.asyncio
async def test_register_allows_null_display_name(
    service: AuthService,
    repository: FakeUserRepository,
) -> None:
    """Missing display name is stored as ``None``."""

    await service.register(
        _valid_payload(display_name=None),
    )

    assert repository.create_calls[0]["display_name"] is None


@pytest.mark.asyncio
async def test_register_conflict_on_existing_username(
    service: AuthService,
    repository: FakeUserRepository,
) -> None:
    """Duplicate username yields HTTP 409."""

    repository.by_username["alice_1"] = FakeUser(
        id=uuid.uuid4(),
        username="alice_1",
        email="other@example.com",
        display_name=None,
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.register(_valid_payload())

    assert exc_info.value.status_code == status.HTTP_409_CONFLICT
    assert "Username" in str(exc_info.value.detail)
    assert repository.create_calls == []


@pytest.mark.asyncio
async def test_register_conflict_on_existing_email(
    service: AuthService,
    repository: FakeUserRepository,
) -> None:
    """Duplicate email yields HTTP 409."""

    repository.by_email["alice@example.com"] = FakeUser(
        id=uuid.uuid4(),
        username="other_user",
        email="alice@example.com",
        display_name=None,
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.register(_valid_payload())

    assert exc_info.value.status_code == status.HTTP_409_CONFLICT
    assert "Email" in str(exc_info.value.detail)
    assert repository.create_calls == []


@pytest.mark.asyncio
async def test_register_conflict_on_integrity_error(
    service: AuthService,
    repository: FakeUserRepository,
) -> None:
    """Race-condition unique violation maps to HTTP 409."""

    repository.raise_integrity = True

    with pytest.raises(HTTPException) as exc_info:
        await service.register(_valid_payload())

    assert exc_info.value.status_code == status.HTTP_409_CONFLICT
    assert "already registered" in str(exc_info.value.detail).lower()


def _login_payload(**overrides: Any) -> LoginRequest:
    """Build a valid ``LoginRequest`` with optional overrides."""

    data: dict[str, Any] = {
        "email": "alice@example.com",
        "password": "Secret1!",
    }
    data.update(overrides)

    return LoginRequest(**data)


def _seed_login_user(
    repository: FakeUserRepository,
    *,
    is_active: bool = True,
) -> FakeUser:
    """Register a user row on the fake repository for login tests."""

    user = FakeUser(
        id=uuid.UUID("00000000-0000-4000-8000-000000000001"),
        username="alice_1",
        email="alice@example.com",
        display_name="Alice",
        is_active=is_active,
    )
    repository.by_email[user.email] = user

    return user


@pytest.mark.asyncio
async def test_login_returns_user_response(
    service: AuthService,
    repository: FakeUserRepository,
) -> None:
    """Successful login returns the public profile and records success."""

    user = _seed_login_user(repository)
    credential = FakeCredential(password_hash=hash_password("Secret1!"))

    with patch(
        "app.services.auth.UserCredential.get_by_user_id",
        new_callable=AsyncMock,
        return_value=credential,
    ):
        result = await service.login(_login_payload())

    assert isinstance(result, UserResponse)
    assert result.id == user.id
    assert result.email == "alice@example.com"
    assert result.username == "alice_1"
    assert repository.login_success_calls == [user]
    assert repository.login_failure_calls == []


@pytest.mark.asyncio
async def test_login_unknown_email_returns_401(
    service: AuthService,
    repository: FakeUserRepository,
) -> None:
    """Unknown email yields a generic 401 (no enumeration)."""

    with pytest.raises(HTTPException) as exc_info:
        await service.login(_login_payload())

    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert "Invalid email or password" in str(exc_info.value.detail)
    assert repository.login_success_calls == []
    assert repository.login_failure_calls == []


@pytest.mark.asyncio
async def test_login_wrong_password_returns_401_and_records_failure(
    service: AuthService,
    repository: FakeUserRepository,
) -> None:
    """Wrong password yields generic 401 and records a failure."""

    user = _seed_login_user(repository)
    credential = FakeCredential(password_hash=hash_password("Secret1!"))

    with patch(
        "app.services.auth.UserCredential.get_by_user_id",
        new_callable=AsyncMock,
        return_value=credential,
    ):
        with pytest.raises(HTTPException) as exc_info:
            await service.login(_login_payload(password="Wrong1!"))

    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert "Invalid email or password" in str(exc_info.value.detail)
    assert repository.login_failure_calls == [user]
    assert repository.login_success_calls == []


@pytest.mark.asyncio
async def test_login_missing_credential_returns_401(
    service: AuthService,
    repository: FakeUserRepository,
) -> None:
    """User without credential row is treated as invalid login."""

    _seed_login_user(repository)

    with patch(
        "app.services.auth.UserCredential.get_by_user_id",
        new_callable=AsyncMock,
        return_value=None,
    ):
        with pytest.raises(HTTPException) as exc_info:
            await service.login(_login_payload())

    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert repository.login_success_calls == []


@pytest.mark.asyncio
async def test_login_disabled_account_returns_403(
    service: AuthService,
    repository: FakeUserRepository,
) -> None:
    """Inactive accounts cannot sign in."""

    _seed_login_user(repository, is_active=False)

    with pytest.raises(HTTPException) as exc_info:
        await service.login(_login_payload())

    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
    assert "disabled" in str(exc_info.value.detail).lower()


@pytest.mark.asyncio
async def test_login_locked_account_returns_403(
    service: AuthService,
    repository: FakeUserRepository,
) -> None:
    """Locked accounts cannot sign in until the lock expires."""

    _seed_login_user(repository)
    locked_until = datetime.datetime.now(datetime.timezone.utc).replace(
        tzinfo=None,
    ) + datetime.timedelta(minutes=10)
    credential = FakeCredential(
        password_hash=hash_password("Secret1!"),
        locked_until=locked_until,
    )

    with patch(
        "app.services.auth.UserCredential.get_by_user_id",
        new_callable=AsyncMock,
        return_value=credential,
    ):
        with pytest.raises(HTTPException) as exc_info:
            await service.login(_login_payload())

    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
    assert "locked" in str(exc_info.value.detail).lower()
    assert repository.login_success_calls == []


@pytest.mark.asyncio
async def test_login_expired_lock_allows_success(
    service: AuthService,
    repository: FakeUserRepository,
) -> None:
    """Expired lock does not block a valid password."""

    user = _seed_login_user(repository)
    locked_until = datetime.datetime.now(datetime.timezone.utc).replace(
        tzinfo=None,
    ) - datetime.timedelta(minutes=1)
    credential = FakeCredential(
        password_hash=hash_password("Secret1!"),
        locked_until=locked_until,
    )

    with patch(
        "app.services.auth.UserCredential.get_by_user_id",
        new_callable=AsyncMock,
        return_value=credential,
    ):
        result = await service.login(_login_payload())

    assert result.username == "alice_1"
    assert repository.login_success_calls == [user]
