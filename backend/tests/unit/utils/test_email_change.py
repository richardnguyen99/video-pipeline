"""Unit tests for ``app.utils.email_change``."""

from __future__ import annotations

from typing import Optional
from uuid import uuid4

import pytest

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


class _FakeStore:
    """In-memory Redis stand-in with TTL metadata."""

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


def test_hash_token_is_stable_sha256() -> None:
    assert hash_token("abc") == hash_token("abc")
    assert hash_token("abc") != hash_token("abd")
    assert len(hash_token("abc")) == 64


def test_generate_tokens_are_urlsafe_and_distinct() -> None:
    a = generate_token()
    b = generate_token()
    form_a = generate_form_id()
    xsrf_a = generate_xsrf_token()

    assert a != b
    assert len(a) >= 32
    assert len(form_a) >= 16
    assert len(xsrf_a) >= 32


@pytest.mark.asyncio
async def test_store_and_peek_intent_token() -> None:
    store = _FakeStore()
    user_id = uuid4()
    raw = generate_token()

    await store_intent_token(
        store,
        user_id=user_id,
        raw_token=raw,
        ttl_seconds=900,
        cooldown_seconds=300,
    )

    assert await peek_intent_user_id(store, raw) == user_id
    assert await get_intent_cooldown_remaining(store, user_id) == 300


@pytest.mark.asyncio
async def test_consume_intent_token_is_one_shot() -> None:
    store = _FakeStore()
    user_id = uuid4()
    raw = generate_token()

    await store_intent_token(
        store,
        user_id=user_id,
        raw_token=raw,
        ttl_seconds=900,
        cooldown_seconds=0,
    )

    assert await consume_intent_token(store, raw) == user_id
    assert await consume_intent_token(store, raw) is None
    assert await peek_intent_user_id(store, raw) is None


@pytest.mark.asyncio
async def test_form_session_stores_xsrf_hash_not_plaintext() -> None:
    store = _FakeStore()
    user_id = uuid4()
    form_id = generate_form_id()
    xsrf = generate_xsrf_token()
    intent_hash = hash_token("intent-raw")

    await store_form_session(
        store,
        form_id=form_id,
        user_id=user_id,
        intent_token_hash=intent_hash,
        xsrf_token=xsrf,
        ttl_seconds=600,
    )

    session = await load_form_session(store, form_id)

    assert session is not None
    assert session["user_id"] == str(user_id)
    assert session["intent_token_hash"] == intent_hash
    assert session["xsrf_hash"] == hash_token(xsrf)
    assert xsrf not in store.values[f"auth:email_change:form:{form_id}"]

    await delete_form_session(store, form_id)
    assert await load_form_session(store, form_id) is None


@pytest.mark.asyncio
async def test_pending_email_change_consume_returns_user_and_email() -> None:
    store = _FakeStore()
    user_id = uuid4()
    raw = generate_token()

    await store_pending_email_change(
        store,
        user_id=user_id,
        new_email="new@example.com",
        raw_token=raw,
        ttl_seconds=900,
    )

    first = await consume_pending_email_change(store, raw)
    second = await consume_pending_email_change(store, raw)

    assert first == (user_id, "new@example.com")
    assert second is None


@pytest.mark.asyncio
async def test_peek_intent_rejects_empty_token() -> None:
    store = _FakeStore()

    assert await peek_intent_user_id(store, "") is None
    assert await consume_intent_token(store, "   ") is None
