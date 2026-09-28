"""Unit tests for JWT JTI denylist and refresh-rotation grace helpers."""

from __future__ import annotations

from typing import Optional

import pytest

from app.utils.token_denylist import (
    consume_refresh_jti,
    denylist_key,
    get_refresh_rotation_grace,
    is_access_jti_revoked,
    refresh_grace_key,
    revoke_access_jti,
    store_refresh_rotation_grace,
)


class _FakeStore:
    """In-memory stand-in for the async Redis client."""

    def __init__(self) -> None:
        self._data: dict[str, str] = {}
        self.last_ex: Optional[int] = None
        self.last_nx: Optional[bool] = None

    async def set(
        self,
        name: str,
        value: str,
        ex: Optional[int] = None,
        nx: Optional[bool] = None,
    ) -> Optional[bool]:
        self.last_ex = ex
        self.last_nx = nx

        if nx and name in self._data:
            return None

        self._data[name] = value

        return True

    async def get(self, name: str) -> Optional[str]:
        return self._data.get(name)

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


@pytest.mark.asyncio
async def test_consume_refresh_jti_succeeds_once() -> None:
    """First consume wins; second consume of the same jti fails."""

    store = _FakeStore()
    jti = "refresh-jti-1"

    first = await consume_refresh_jti(store, jti, ttl_seconds=3600)
    second = await consume_refresh_jti(store, jti, ttl_seconds=3600)

    assert first is True
    assert second is False
    assert store.last_nx is True
    assert store._data[denylist_key(jti)] == "1"
    assert await is_access_jti_revoked(store, jti) is True


@pytest.mark.asyncio
async def test_consume_refresh_jti_rejects_empty_or_zero_ttl() -> None:
    """Invalid inputs do not write denylist keys."""

    store = _FakeStore()

    assert await consume_refresh_jti(store, "", ttl_seconds=60) is False
    assert await consume_refresh_jti(store, "jti", ttl_seconds=0) is False
    assert store._data == {}


@pytest.mark.asyncio
async def test_revoke_after_consume_still_revoked() -> None:
    """Forced revoke after consume keeps the denylist entry."""

    store = _FakeStore()
    jti = "refresh-jti-2"

    assert await consume_refresh_jti(store, jti, ttl_seconds=100) is True

    await revoke_access_jti(store, jti, ttl_seconds=50)

    assert await is_access_jti_revoked(store, jti) is True
    assert store.last_ex == 50


@pytest.mark.asyncio
async def test_store_and_get_refresh_rotation_grace() -> None:
    """Grace cache returns the same rotated pair within the window."""

    store = _FakeStore()
    jti = "old-refresh-jti"

    await store_refresh_rotation_grace(
        store,
        jti,
        access_token="access.jwt",
        refresh_token="refresh.jwt",
        grace_seconds=30,
    )

    assert store.last_ex == 30
    assert refresh_grace_key(jti) in store._data

    pair = await get_refresh_rotation_grace(store, jti)

    assert pair is not None
    assert pair.access_token == "access.jwt"
    assert pair.refresh_token == "refresh.jwt"


@pytest.mark.asyncio
async def test_get_refresh_rotation_grace_missing() -> None:
    """Missing grace key yields None (treat as hard revoke after window)."""

    store = _FakeStore()

    assert await get_refresh_rotation_grace(store, "unknown") is None
    assert await get_refresh_rotation_grace(store, "") is None


@pytest.mark.asyncio
async def test_store_refresh_rotation_grace_skips_invalid() -> None:
    """Empty jti, zero grace, or empty tokens do not write keys."""

    store = _FakeStore()

    await store_refresh_rotation_grace(
        store,
        "",
        access_token="a",
        refresh_token="r",
        grace_seconds=30,
    )
    await store_refresh_rotation_grace(
        store,
        "jti",
        access_token="a",
        refresh_token="r",
        grace_seconds=0,
    )
    await store_refresh_rotation_grace(
        store,
        "jti",
        access_token="",
        refresh_token="r",
        grace_seconds=30,
    )

    assert store._data == {}
