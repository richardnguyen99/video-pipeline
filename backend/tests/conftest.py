"""Shared pytest fixtures for backend unit tests."""

from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.config import Settings


@pytest.fixture
def settings() -> Settings:
    """Isolated settings instance (no real env/DB dependency)."""

    return Settings(
        app_name="video-pipeline-test",
        app_version="0.0.0-test",
        debug=True,
        database_url="postgresql://test:test@localhost:5432/test",
    )


@pytest.fixture
def mock_session() -> MagicMock:
    """Synchronous-style mock stand-in for SQLAlchemy session APIs."""

    session = MagicMock()
    session.commit = MagicMock()
    session.rollback = MagicMock()
    session.close = MagicMock()
    session.add = MagicMock()
    session.delete = MagicMock()
    session.exec = MagicMock()
    session.get = MagicMock()

    return session


@pytest.fixture
def mock_async_session() -> AsyncMock:
    """Async session mock for service methods that take AsyncSession."""

    session = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.close = AsyncMock()
    session.add = MagicMock()
    session.delete = MagicMock()
    session.exec = AsyncMock()
    session.get = AsyncMock()
    session.refresh = AsyncMock()

    return session


@pytest.fixture
async def async_session_ctx(
    mock_async_session: AsyncMock,
) -> AsyncGenerator[AsyncMock, None]:
    """Yield an async session mock as an async context manager body.

    Declared with ``@pytest.fixture`` (not ``pytest_asyncio.fixture``) so
    ``pylint-pytest`` can recognize it under ``asyncio_mode = auto``.
    """

    yield mock_async_session


@pytest.fixture
def any_object() -> dict[str, Any]:
    """Generic mutable bag for ad-hoc mock payloads."""

    return {}
