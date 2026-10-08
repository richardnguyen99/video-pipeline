"""Unit tests for ``app.services.playlist.PlaylistService``."""

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Any, Optional, cast
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException, status

from app.models import playlist as playlist_mod
from app.models.playlist import Playlist, PlaylistVisibility
from app.repositories.video import VideoRepository
from app.schemas.playlist import (
    PlaylistCreateRequest,
    PlaylistUpdateRequest,
    PlaylistVisibilityChangeRequest,
)
from app.schemas.video import VideoResponse
from app.services.playlist import PlaylistService


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class _FakeVideoRepository:
    """Repository stub with exists_by_id and a session placeholder."""

    def __init__(self, *, exists: bool = True) -> None:
        self.exists = exists
        self.session = object()
        self.added: list[Any] = []
        self.committed = 0
        self.refreshed: list[Any] = []

    async def exists_by_id(self, _video_id: int) -> bool:
        return self.exists


class _SessionSpy:
    """Session stand-in that records add / commit / refresh / delete."""

    def __init__(self) -> None:
        self.added: list[Any] = []
        self.committed = 0
        self.refreshed: list[Any] = []
        self.deleted: list[Any] = []

    def add(self, obj: Any) -> None:
        self.added.append(obj)

    async def commit(self) -> None:
        self.committed += 1

    async def refresh(self, obj: Any) -> None:
        self.refreshed.append(obj)

    async def delete(self, obj: Any) -> None:
        self.deleted.append(obj)


def _playlist(
    *,
    owner_id: UUID,
    name: str = "Later",
    visibility: PlaylistVisibility = PlaylistVisibility.PRIVATE,
) -> Playlist:
    return Playlist(
        id=uuid4(),
        owner_id=owner_id,
        name=name,
        description=None,
        visibility=visibility,
        created_at=_now(),
        updated_at=_now(),
    )


@pytest.mark.asyncio
async def test_create_playlist_persists_and_returns_summary(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Create stores a playlist and returns a summary with zero videos."""

    user_id = uuid4()
    session = _SessionSpy()
    repository = _FakeVideoRepository()
    repository.session = session
    service = PlaylistService(
        video_repository=cast(VideoRepository, repository),
    )

    async def fake_count(
        _session: object,
        _playlist_id: UUID,
    ) -> int:
        return 0

    monkeypatch.setattr(
        playlist_mod.PlaylistVideo,
        "count_for_playlist",
        staticmethod(fake_count),
    )

    result = await service.create(
        user_id=user_id,
        payload=PlaylistCreateRequest(name="  Watch later  "),
    )

    assert result.name == "Watch later"
    assert result.owner_id == user_id
    assert result.visibility == PlaylistVisibility.PRIVATE
    assert result.video_count == 0
    assert session.committed == 1
    assert len(session.added) == 1


@pytest.mark.asyncio
async def test_create_playlist_rejects_blank_name() -> None:
    """Whitespace-only names yield HTTP 400."""

    repository = _FakeVideoRepository()
    repository.session = _SessionSpy()
    service = PlaylistService(
        video_repository=cast(VideoRepository, repository),
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.create(
            user_id=uuid4(),
            payload=PlaylistCreateRequest(name="   "),
        )

    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.asyncio
async def test_list_owned_returns_paginated_summaries(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """list_owned maps rows to responses with video counts."""

    user_id = uuid4()
    row = _playlist(owner_id=user_id, name="A")
    repository = _FakeVideoRepository()
    repository.session = _SessionSpy()
    service = PlaylistService(
        video_repository=cast(VideoRepository, repository),
    )

    async def fake_list(
        _session: object,
        owner_id: UUID,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Playlist]:
        assert owner_id == user_id
        assert limit == 20
        assert offset == 0

        return [row]

    async def fake_count_owned(
        _session: object,
        owner_id: UUID,
    ) -> int:
        assert owner_id == user_id

        return 1

    async def fake_count_videos(
        _session: object,
        playlist_id: UUID,
    ) -> int:
        assert playlist_id == row.id

        return 4

    monkeypatch.setattr(
        playlist_mod.Playlist,
        "list_owned_by_user",
        staticmethod(fake_list),
    )
    monkeypatch.setattr(
        playlist_mod.Playlist,
        "count_owned_by_user",
        staticmethod(fake_count_owned),
    )

    async def fake_thumbnails(
        _session: object,
        playlist_ids: list[UUID],
    ) -> dict[UUID, str | None]:
        return {playlist_id: None for playlist_id in playlist_ids}

    monkeypatch.setattr(
        playlist_mod.PlaylistVideo,
        "count_for_playlist",
        staticmethod(fake_count_videos),
    )
    monkeypatch.setattr(
        playlist_mod.PlaylistVideo,
        "first_thumbnail_urls_for_playlists",
        staticmethod(fake_thumbnails),
    )

    result = await service.list_owned(user_id=user_id, limit=20, offset=0)

    assert result.total == 1
    assert result.limit == 20
    assert len(result.items) == 1
    assert result.items[0].name == "A"
    assert result.items[0].video_count == 4
    assert result.items[0].thumbnail_url is None


@pytest.mark.asyncio
async def test_get_detail_raises_when_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Unknown playlist ids yield HTTP 404."""

    repository = _FakeVideoRepository()
    repository.session = _SessionSpy()
    service = PlaylistService(
        video_repository=cast(VideoRepository, repository),
    )

    async def fake_get(
        _session: object,
        _playlist_id: UUID,
    ) -> Optional[Playlist]:
        return None

    monkeypatch.setattr(
        playlist_mod.Playlist,
        "get_by_id",
        staticmethod(fake_get),
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.get_detail(uuid4(), user_id=uuid4())

    assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.asyncio
async def test_get_detail_raises_when_not_accessible(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Inaccessible private playlists yield HTTP 403."""

    owner_id = uuid4()
    viewer_id = uuid4()
    row = _playlist(owner_id=owner_id, visibility=PlaylistVisibility.PRIVATE)
    repository = _FakeVideoRepository()
    repository.session = _SessionSpy()
    service = PlaylistService(
        video_repository=cast(VideoRepository, repository),
    )

    async def fake_get(
        _session: object,
        playlist_id: UUID,
    ) -> Optional[Playlist]:
        assert playlist_id == row.id

        return row

    async def fake_accessible(
        _session: object,
        playlist: Playlist,
        user_id: Optional[UUID],
    ) -> bool:
        assert playlist.id == row.id
        assert user_id == viewer_id

        return False

    monkeypatch.setattr(
        playlist_mod.Playlist,
        "get_by_id",
        staticmethod(fake_get),
    )
    monkeypatch.setattr(
        playlist_mod.Playlist,
        "is_accessible_by",
        staticmethod(fake_accessible),
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.get_detail(row.id, user_id=viewer_id)

    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.asyncio
async def test_get_detail_returns_ordered_videos(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Accessible playlists include videos in membership order."""

    user_id = uuid4()
    row = _playlist(owner_id=user_id)
    repository = _FakeVideoRepository()
    repository.session = _SessionSpy()
    service = PlaylistService(
        video_repository=cast(VideoRepository, repository),
    )

    video_a = VideoResponse(
        id=10,
        video_id="A-001",
        views=0,
        likes=0,
        dislikes=0,
        comments=0,
    )
    video_b = VideoResponse(
        id=20,
        video_id="B-002",
        views=0,
        likes=0,
        dislikes=0,
        comments=0,
    )

    async def fake_get(
        _session: object,
        playlist_id: UUID,
    ) -> Optional[Playlist]:
        return row if playlist_id == row.id else None

    async def fake_accessible(
        _session: object,
        _playlist: Playlist,
        _user_id: Optional[UUID],
    ) -> bool:
        return True

    async def fake_entries(
        _session: object,
        playlist_id: UUID,
    ) -> list[Any]:
        assert playlist_id == row.id

        return [
            SimpleNamespace(video_id=20),
            SimpleNamespace(video_id=10),
        ]

    async def fake_count(
        _session: object,
        _playlist_id: UUID,
    ) -> int:
        return 2

    async def fake_list_by_ids(
        self: Any,
        video_ids: list[int],
    ) -> list[VideoResponse]:
        assert video_ids == [20, 10]

        return [video_a, video_b]

    monkeypatch.setattr(
        playlist_mod.Playlist,
        "get_by_id",
        staticmethod(fake_get),
    )
    monkeypatch.setattr(
        playlist_mod.Playlist,
        "is_accessible_by",
        staticmethod(fake_accessible),
    )
    monkeypatch.setattr(
        playlist_mod.PlaylistVideo,
        "get_videos_in_playlist",
        staticmethod(fake_entries),
    )
    monkeypatch.setattr(
        playlist_mod.PlaylistVideo,
        "count_for_playlist",
        staticmethod(fake_count),
    )
    monkeypatch.setattr(
        "app.services.playlist.VideoService.list_by_ids",
        fake_list_by_ids,
    )

    result = await service.get_detail(row.id, user_id=user_id)

    assert [video.id for video in result.videos] == [20, 10]
    assert result.video_count == 2


@pytest.mark.asyncio
async def test_update_requires_owner(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Non-owners cannot update playlist metadata."""

    owner_id = uuid4()
    other_id = uuid4()
    row = _playlist(owner_id=owner_id)
    repository = _FakeVideoRepository()
    repository.session = _SessionSpy()
    service = PlaylistService(
        video_repository=cast(VideoRepository, repository),
    )

    async def fake_get(
        _session: object,
        playlist_id: UUID,
    ) -> Optional[Playlist]:
        return row if playlist_id == row.id else None

    monkeypatch.setattr(
        playlist_mod.Playlist,
        "get_by_id",
        staticmethod(fake_get),
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.update(
            row.id,
            user_id=other_id,
            payload=PlaylistUpdateRequest(name="Nope"),
        )

    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.asyncio
async def test_update_rejects_empty_payload(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Updates with no fields yield HTTP 400."""

    user_id = uuid4()
    row = _playlist(owner_id=user_id)
    repository = _FakeVideoRepository()
    repository.session = _SessionSpy()
    service = PlaylistService(
        video_repository=cast(VideoRepository, repository),
    )

    async def fake_get(
        _session: object,
        playlist_id: UUID,
    ) -> Optional[Playlist]:
        return row if playlist_id == row.id else None

    monkeypatch.setattr(
        playlist_mod.Playlist,
        "get_by_id",
        staticmethod(fake_get),
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.update(
            row.id,
            user_id=user_id,
            payload=PlaylistUpdateRequest(),
        )

    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.asyncio
async def test_update_renames_playlist(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Owners can rename a playlist."""

    user_id = uuid4()
    row = _playlist(owner_id=user_id, name="Old")
    session = _SessionSpy()
    repository = _FakeVideoRepository()
    repository.session = session
    service = PlaylistService(
        video_repository=cast(VideoRepository, repository),
    )

    async def fake_get(
        _session: object,
        playlist_id: UUID,
    ) -> Optional[Playlist]:
        return row if playlist_id == row.id else None

    async def fake_count(
        _session: object,
        _playlist_id: UUID,
    ) -> int:
        return 0

    monkeypatch.setattr(
        playlist_mod.Playlist,
        "get_by_id",
        staticmethod(fake_get),
    )
    monkeypatch.setattr(
        playlist_mod.PlaylistVideo,
        "count_for_playlist",
        staticmethod(fake_count),
    )

    result = await service.update(
        row.id,
        user_id=user_id,
        payload=PlaylistUpdateRequest(name="  New name  "),
    )

    assert result.name == "New name"
    assert session.committed == 1


@pytest.mark.asyncio
async def test_delete_requires_owner(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Non-owners cannot delete playlists."""

    owner_id = uuid4()
    other_id = uuid4()
    row = _playlist(owner_id=owner_id)
    repository = _FakeVideoRepository()
    repository.session = _SessionSpy()
    service = PlaylistService(
        video_repository=cast(VideoRepository, repository),
    )

    async def fake_get(
        _session: object,
        playlist_id: UUID,
    ) -> Optional[Playlist]:
        return row if playlist_id == row.id else None

    monkeypatch.setattr(
        playlist_mod.Playlist,
        "get_by_id",
        staticmethod(fake_get),
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.delete(row.id, user_id=other_id)

    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.asyncio
async def test_delete_owner_succeeds(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Owners can delete their playlists."""

    user_id = uuid4()
    row = _playlist(owner_id=user_id)
    repository = _FakeVideoRepository()
    repository.session = _SessionSpy()
    service = PlaylistService(
        video_repository=cast(VideoRepository, repository),
    )
    delete_calls: list[UUID] = []

    async def fake_get(
        _session: object,
        playlist_id: UUID,
    ) -> Optional[Playlist]:
        return row if playlist_id == row.id else None

    async def fake_delete(
        _session: object,
        playlist: Playlist,
    ) -> None:
        delete_calls.append(playlist.id)

    monkeypatch.setattr(
        playlist_mod.Playlist,
        "get_by_id",
        staticmethod(fake_get),
    )
    monkeypatch.setattr(
        playlist_mod.Playlist,
        "delete",
        staticmethod(fake_delete),
    )

    await service.delete(row.id, user_id=user_id)

    assert delete_calls == [row.id]


@pytest.mark.asyncio
async def test_add_video_raises_when_video_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Missing videos yield HTTP 404."""

    user_id = uuid4()
    row = _playlist(owner_id=user_id)
    repository = _FakeVideoRepository(exists=False)
    repository.session = _SessionSpy()
    service = PlaylistService(
        video_repository=cast(VideoRepository, repository),
    )

    async def fake_get(
        _session: object,
        playlist_id: UUID,
    ) -> Optional[Playlist]:
        return row if playlist_id == row.id else None

    monkeypatch.setattr(
        playlist_mod.Playlist,
        "get_by_id",
        staticmethod(fake_get),
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.add_video(row.id, user_id=user_id, video_id=99)

    assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.asyncio
async def test_add_video_appends_when_not_present(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """New memberships are appended to the playlist."""

    user_id = uuid4()
    row = _playlist(owner_id=user_id)
    session = _SessionSpy()
    repository = _FakeVideoRepository(exists=True)
    repository.session = session
    service = PlaylistService(
        video_repository=cast(VideoRepository, repository),
    )
    add_calls: list[dict[str, Any]] = []

    async def fake_get(
        _session: object,
        playlist_id: UUID,
    ) -> Optional[Playlist]:
        return row if playlist_id == row.id else None

    async def fake_existing(
        _session: object,
        _playlist_id: UUID,
        _video_id: int,
    ) -> None:
        return None

    async def fake_add(
        _session: object,
        playlist_id: UUID,
        video_id: int,
    ) -> Any:
        add_calls.append({"playlist_id": playlist_id, "video_id": video_id})

        return SimpleNamespace(playlist_id=playlist_id, video_id=video_id)

    async def fake_count(
        _session: object,
        _playlist_id: UUID,
    ) -> int:
        return 1

    monkeypatch.setattr(
        playlist_mod.Playlist,
        "get_by_id",
        staticmethod(fake_get),
    )
    monkeypatch.setattr(
        playlist_mod.PlaylistVideo,
        "get_by_playlist_and_video",
        staticmethod(fake_existing),
    )
    monkeypatch.setattr(
        playlist_mod.PlaylistVideo,
        "add_video",
        staticmethod(fake_add),
    )
    monkeypatch.setattr(
        playlist_mod.PlaylistVideo,
        "count_for_playlist",
        staticmethod(fake_count),
    )

    result = await service.add_video(row.id, user_id=user_id, video_id=7)

    assert result.video_count == 1
    assert add_calls == [{"playlist_id": row.id, "video_id": 7}]
    assert session.committed >= 1


@pytest.mark.asyncio
async def test_add_video_noop_when_already_present(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Existing memberships are not duplicated."""

    user_id = uuid4()
    row = _playlist(owner_id=user_id)
    session = _SessionSpy()
    repository = _FakeVideoRepository(exists=True)
    repository.session = session
    service = PlaylistService(
        video_repository=cast(VideoRepository, repository),
    )
    add_calls: list[Any] = []

    async def fake_get(
        _session: object,
        playlist_id: UUID,
    ) -> Optional[Playlist]:
        return row if playlist_id == row.id else None

    async def fake_existing(
        _session: object,
        _playlist_id: UUID,
        _video_id: int,
    ) -> Any:
        return SimpleNamespace(video_id=7)

    async def fake_add(
        _session: object,
        playlist_id: UUID,
        video_id: int,
    ) -> Any:
        add_calls.append((playlist_id, video_id))

        return SimpleNamespace()

    async def fake_count(
        _session: object,
        _playlist_id: UUID,
    ) -> int:
        return 1

    monkeypatch.setattr(
        playlist_mod.Playlist,
        "get_by_id",
        staticmethod(fake_get),
    )
    monkeypatch.setattr(
        playlist_mod.PlaylistVideo,
        "get_by_playlist_and_video",
        staticmethod(fake_existing),
    )
    monkeypatch.setattr(
        playlist_mod.PlaylistVideo,
        "add_video",
        staticmethod(fake_add),
    )
    monkeypatch.setattr(
        playlist_mod.PlaylistVideo,
        "count_for_playlist",
        staticmethod(fake_count),
    )

    result = await service.add_video(row.id, user_id=user_id, video_id=7)

    assert result.video_count == 1
    assert add_calls == []


@pytest.mark.asyncio
async def test_remove_video_raises_when_not_in_playlist(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Removing a non-member video yields HTTP 404."""

    user_id = uuid4()
    row = _playlist(owner_id=user_id)
    repository = _FakeVideoRepository()
    repository.session = _SessionSpy()
    service = PlaylistService(
        video_repository=cast(VideoRepository, repository),
    )

    async def fake_get(
        _session: object,
        playlist_id: UUID,
    ) -> Optional[Playlist]:
        return row if playlist_id == row.id else None

    async def fake_remove(
        _session: object,
        _playlist_id: UUID,
        _video_id: int,
    ) -> bool:
        return False

    monkeypatch.setattr(
        playlist_mod.Playlist,
        "get_by_id",
        staticmethod(fake_get),
    )
    monkeypatch.setattr(
        playlist_mod.PlaylistVideo,
        "remove_video",
        staticmethod(fake_remove),
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.remove_video(row.id, user_id=user_id, video_id=3)

    assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.asyncio
async def test_remove_video_succeeds(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Owners can remove videos from their playlists."""

    user_id = uuid4()
    row = _playlist(owner_id=user_id)
    session = _SessionSpy()
    repository = _FakeVideoRepository()
    repository.session = session
    service = PlaylistService(
        video_repository=cast(VideoRepository, repository),
    )

    async def fake_get(
        _session: object,
        playlist_id: UUID,
    ) -> Optional[Playlist]:
        return row if playlist_id == row.id else None

    async def fake_remove(
        _session: object,
        playlist_id: UUID,
        video_id: int,
    ) -> bool:
        assert playlist_id == row.id
        assert video_id == 3

        return True

    async def fake_count(
        _session: object,
        _playlist_id: UUID,
    ) -> int:
        return 0

    monkeypatch.setattr(
        playlist_mod.Playlist,
        "get_by_id",
        staticmethod(fake_get),
    )
    monkeypatch.setattr(
        playlist_mod.PlaylistVideo,
        "remove_video",
        staticmethod(fake_remove),
    )
    monkeypatch.setattr(
        playlist_mod.PlaylistVideo,
        "count_for_playlist",
        staticmethod(fake_count),
    )

    result = await service.remove_video(row.id, user_id=user_id, video_id=3)

    assert result.video_count == 0
    assert session.committed >= 1


@pytest.mark.asyncio
async def test_change_visibility_requires_owner(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Non-owners cannot change playlist visibility."""

    owner_id = uuid4()
    other_id = uuid4()
    row = _playlist(owner_id=owner_id, visibility=PlaylistVisibility.PRIVATE)
    repository = _FakeVideoRepository()
    repository.session = _SessionSpy()
    service = PlaylistService(
        video_repository=cast(VideoRepository, repository),
    )

    async def fake_get(
        _session: object,
        playlist_id: UUID,
    ) -> Optional[Playlist]:
        return row if playlist_id == row.id else None

    monkeypatch.setattr(
        playlist_mod.Playlist,
        "get_by_id",
        staticmethod(fake_get),
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.change_visibility(
            row.id,
            user_id=other_id,
            payload=PlaylistVisibilityChangeRequest(
                visibility=PlaylistVisibility.PUBLIC,
            ),
        )

    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.asyncio
async def test_change_visibility_updates_level(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Owners can switch visibility between private, restricted, and public."""

    owner_id = uuid4()
    row = _playlist(owner_id=owner_id, visibility=PlaylistVisibility.PRIVATE)
    session = _SessionSpy()
    repository = _FakeVideoRepository()
    repository.session = session
    service = PlaylistService(
        video_repository=cast(VideoRepository, repository),
    )

    async def fake_get(
        _session: object,
        playlist_id: UUID,
    ) -> Optional[Playlist]:
        return row if playlist_id == row.id else None

    async def fake_count(
        _session: object,
        _playlist_id: UUID,
    ) -> int:
        return 0

    monkeypatch.setattr(
        playlist_mod.Playlist,
        "get_by_id",
        staticmethod(fake_get),
    )
    monkeypatch.setattr(
        playlist_mod.PlaylistVideo,
        "count_for_playlist",
        staticmethod(fake_count),
    )

    result = await service.change_visibility(
        row.id,
        user_id=owner_id,
        payload=PlaylistVisibilityChangeRequest(
            visibility=PlaylistVisibility.RESTRICTED,
        ),
    )

    assert result.visibility == PlaylistVisibility.RESTRICTED
    assert row.visibility == PlaylistVisibility.RESTRICTED
    assert session.committed == 1
