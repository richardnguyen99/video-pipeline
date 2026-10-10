"""Unit tests for ``app.schemas.actress_subscribe``."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from app.schemas.actress_subscribe import (
    ActressSubscribeItem,
    ActressSubscribeListResponse,
    ActressSubscribeStatusResponse,
)


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def test_status_response_requires_positive_actress_id() -> None:
    """Actress ids must be at least 1."""

    with pytest.raises(ValidationError):
        ActressSubscribeStatusResponse(
            actress_id=0,
            is_subscribed=False,
            sub_cnt=0,
        )


def test_status_response_rejects_negative_sub_cnt() -> None:
    """Subscriber counts cannot be negative."""

    with pytest.raises(ValidationError):
        ActressSubscribeStatusResponse(
            actress_id=1,
            is_subscribed=True,
            sub_cnt=-1,
        )


def test_status_response_accepts_valid_payload() -> None:
    """Valid status payloads are accepted."""

    payload = ActressSubscribeStatusResponse(
        actress_id=42,
        is_subscribed=True,
        sub_cnt=3,
    )

    assert payload.actress_id == 42
    assert payload.is_subscribed is True
    assert payload.sub_cnt == 3


def test_subscribe_item_requires_name() -> None:
    """List items require an actress name."""

    with pytest.raises(ValidationError):
        ActressSubscribeItem(
            actress_id=1,
            subscribed_at=_now(),
        )  # type: ignore[call-arg]


def test_subscribe_item_accepts_optional_image_and_ruby() -> None:
    """Optional display fields may be omitted."""

    item = ActressSubscribeItem(
        actress_id=7,
        name="Test Actress",
        subscribed_at=_now(),
    )

    assert item.image_url is None
    assert item.ruby is None


def test_list_response_defaults_items_to_empty() -> None:
    """Empty lists are valid."""

    payload = ActressSubscribeListResponse(
        total=0,
        limit=20,
        offset=0,
    )

    assert payload.items == []


def test_list_response_rejects_negative_total() -> None:
    """Totals cannot be negative."""

    with pytest.raises(ValidationError):
        ActressSubscribeListResponse(
            total=-1,
            limit=20,
            offset=0,
        )


def test_list_response_rejects_zero_limit() -> None:
    """Limit must be at least 1."""

    with pytest.raises(ValidationError):
        ActressSubscribeListResponse(
            total=0,
            limit=0,
            offset=0,
        )
