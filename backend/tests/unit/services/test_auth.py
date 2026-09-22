"""Unit tests for ``app.services.auth.AuthService``."""

from __future__ import annotations

import datetime
import uuid
from dataclasses import dataclass, field
from typing import Any, Optional, cast

import pytest
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

from app.repositories.user import UserRepository
from app.schemas.auth import RegisterRequest, UserResponse
from app.services.auth import AuthService
from app.utils.password import PASSWORD_ALGORITHM, verify_password


@dataclass
class FakeUser:
    """Minimal user stand-in for registration responses."""

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
class FakeUserRepository:
    """In-memory stand-in for ``UserRepository``."""

    by_username: dict[str, FakeUser] = field(default_factory=dict)
    by_email: dict[str, FakeUser] = field(default_factory=dict)
    create_calls: list[dict[str, Any]] = field(default_factory=list)
    raise_integrity: bool = False
    created_user: Optional[FakeUser] = None

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
