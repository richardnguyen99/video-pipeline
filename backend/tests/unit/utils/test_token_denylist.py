"""Unit tests for access-token JTI denylist helpers."""

from __future__ import annotations

from typing import Optional

import pytest

from app.utils.token_denylist import (
    denylist_key,
    is_access_jti_revoked,
    revoke_access_jti,
)


class _FakeStore:
    """In-memory stand-in for the async Redis client."""

    def __init__(self) -> None:
        self._data: dict[str, str] = {}
        self.last_ex: Optional[int] = None

    async def set(
        self,
        name: str,
        value: str,
        ex: Optional[int] = None,
    ) -> bool:
        self._data[name] = value
        self.last_ex = ex

        return True

    async def exists(self, *names: str) -> int:
        return sum(1 for name in names if name in self._data)


@pytest.mark.asyncio
async def test_revoke_access_jti_stores_key_with_ttl() -> None:
    """Revocation writes a keyed flag with the remaining token TTL."""

    store = _FakeStore()
    jti = "token-id-1"

    await revoke_access_jti(store, jti, ttl_seconds=120)

    assert store._data[denylist_key(jti)] == "1"
    assert store.last_ex == 120
    assert await is_access_jti_revoked(store, jti) is True


@pytest.mark.asyncio
async def test_revoke_access_jti_skips_empty_or_zero_ttl() -> None:
    """Empty jti or non-positive TTL is a no-op."""

    store = _FakeStore()

    await revoke_access_jti(store, "", ttl_seconds=60)
    await revoke_access_jti(store, "token-id-2", ttl_seconds=0)

    assert store._data == {}
    assert await is_access_jti_revoked(store, "token-id-2") is False


@pytest.mark.asyncio
async def test_is_access_jti_revoked_false_when_absent() -> None:
    """Unknown jti is not treated as revoked."""

    store = _FakeStore()

    assert await is_access_jti_revoked(store, "missing") is False
    assert await is_access_jti_revoked(store, "") is False
