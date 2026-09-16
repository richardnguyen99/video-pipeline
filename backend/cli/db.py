"""Shared database session helpers for CLI commands."""

from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from sqlmodel.ext.asyncio.session import AsyncSession

from app.database import engine


@asynccontextmanager
async def session_scope() -> AsyncGenerator[AsyncSession]:
    """Yield an async SQLModel session bound to the app engine."""

    async with AsyncSession(engine) as session:
        yield session
