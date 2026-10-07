"""Unit tests for ``app.schemas.playlist``."""

from __future__ import annotations

from datetime import datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.models.playlist import PlaylistVisibility
from app.schemas.playlist import (
    PlaylistAddVideoRequest,
    PlaylistCreateRequest,
    PlaylistDetailResponse,
    PlaylistListResponse,
    PlaylistResponse,
    PlaylistUpdateRequest,
)


def test_create_request_defaults_visibility_private() -> None:
    """New playlists default to private visibility."""

    payload = PlaylistCreateRequest(name="Later")

    assert payload.name == "Later"
    assert payload.description is None
    assert payload.visibility == PlaylistVisibility.PRIVATE


def test_create_request_accepts_public_visibility() -> None:
    """Public visibility is accepted."""

    payload = PlaylistCreateRequest(
        name="Share",
        visibility=PlaylistVisibility.PUBLIC,
        description="for friends",
    )

    assert payload.visibility == PlaylistVisibility.PUBLIC
    assert payload.description == "for friends"


def test_create_request_rejects_empty_name() -> None:
    """Empty names are rejected."""

    with pytest.raises(ValidationError):
        PlaylistCreateRequest(name="")


def test_create_request_rejects_overlong_name() -> None:
    """Names longer than 255 characters are rejected."""

    with pytest.raises(ValidationError):
        PlaylistCreateRequest(name="x" * 256)


def test_update_request_allows_partial_fields() -> None:
    """Update payloads may omit all optional fields."""

    payload = PlaylistUpdateRequest()

    assert payload.name is None
    assert payload.description is None
    assert payload.visibility is None


def test_update_request_rejects_empty_name() -> None:
    """Explicit empty names are rejected."""

    with pytest.raises(ValidationError):
        PlaylistUpdateRequest(name="")


def test_add_video_request_requires_positive_id() -> None:
    """video_id must be at least 1."""

    with pytest.raises(ValidationError):
        PlaylistAddVideoRequest(video_id=0)

    payload = PlaylistAddVideoRequest(video_id=42)

    assert payload.video_id == 42


def test_playlist_response_round_trip() -> None:
    """Playlist summary schema accepts a full payload."""

    now = datetime(2026, 10, 6, 12, 0, 0)
    owner_id = uuid4()
    playlist_id = uuid4()

    payload = PlaylistResponse(
        id=playlist_id,
        owner_id=owner_id,
        name="Watch later",
        description=None,
        visibility=PlaylistVisibility.PRIVATE,
        video_count=3,
        created_at=now,
        updated_at=now,
    )

    assert payload.id == playlist_id
    assert payload.video_count == 3


def test_playlist_list_response_defaults_items() -> None:
    """List responses default to an empty items list."""

    payload = PlaylistListResponse(total=0, limit=20, offset=0)

    assert payload.items == []
    assert payload.total == 0


def test_playlist_detail_response_defaults_videos() -> None:
    """Detail responses default to an empty videos list."""

    now = datetime(2026, 10, 6, 12, 0, 0)
    payload = PlaylistDetailResponse(
        id=uuid4(),
        owner_id=uuid4(),
        name="Empty",
        visibility=PlaylistVisibility.PRIVATE,
        video_count=0,
        created_at=now,
        updated_at=now,
    )

    assert payload.videos == []
