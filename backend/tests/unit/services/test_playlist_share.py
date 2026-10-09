"""Unit tests for playlist sharing on restricted visibility."""

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
    PlaylistShareRequest,
    PlaylistVisibilityChangeRequest,
)
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
        self.exec_first: Any = None
        self.exec_results: list[Any] = []

    def add(self, obj: Any) -> None:
        self.added.append(obj)

    async def commit(self) -> None:
        self.committed += 1

    async def refresh(self, obj: Any) -> None:
        self.refreshed.append(obj)

    async def delete(self, obj: Any) -> None:
        self.deleted.append(obj)

    async def exec(self, _statement: object) -> Any:
        if self.exec_results:
            first_value = self.exec_results.pop(0)
        else:
            first_value = self.exec_first

        class _ExecResult:
            def first(self) -> Any:
                return first_value

            def all(self) -> list[Any]:
                if first_value is None:
                    return []

                if isinstance(first_value, list):
                    return first_value

                return [first_value]

        return _ExecResult()


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
async def test_change_visibility_clears_shares(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Changing visibility removes every existing share."""

    owner_id = uuid4()
    row = _playlist(
        owner_id=owner_id,
        visibility=PlaylistVisibility.RESTRICTED,
    )
    session = _SessionSpy()
    repository = _FakeVideoRepository()
    repository.session = session
    service = PlaylistService(
        video_repository=cast(VideoRepository, repository),
    )
    revoked: list[UUID] = []

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

    async def fake_revoke_all(
        _session: object,
        playlist_id: UUID,
        *,
        commit: bool = True,
    ) -> int:
        revoked.append(playlist_id)
        assert commit is False

        return 2

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
    monkeypatch.setattr(
        playlist_mod.PlaylistShare,
        "revoke_all_for_playlist",
        staticmethod(fake_revoke_all),
    )

    result = await service.change_visibility(
        row.id,
        user_id=owner_id,
        payload=PlaylistVisibilityChangeRequest(
            visibility=PlaylistVisibility.PUBLIC,
        ),
    )

    assert result.visibility == PlaylistVisibility.PUBLIC
    assert revoked == [row.id]
    assert session.committed == 1


@pytest.mark.asyncio
async def test_change_visibility_same_level_skips_share_clear(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Setting the same visibility does not clear shares."""

    owner_id = uuid4()
    row = _playlist(
        owner_id=owner_id,
        visibility=PlaylistVisibility.RESTRICTED,
    )
    session = _SessionSpy()
    repository = _FakeVideoRepository()
    repository.session = session
    service = PlaylistService(
        video_repository=cast(VideoRepository, repository),
    )
    revoke_calls = 0

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

    async def fake_revoke_all(
        _session: object,
        _playlist_id: UUID,
        *,
        commit: bool = True,
    ) -> int:
        del commit
        nonlocal revoke_calls
        revoke_calls += 1

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
    monkeypatch.setattr(
        playlist_mod.PlaylistShare,
        "revoke_all_for_playlist",
        staticmethod(fake_revoke_all),
    )

    await service.change_visibility(
        row.id,
        user_id=owner_id,
        payload=PlaylistVisibilityChangeRequest(
            visibility=PlaylistVisibility.RESTRICTED,
        ),
    )

    assert revoke_calls == 0


@pytest.mark.asyncio
async def test_add_share_requires_restricted_visibility(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Sharing is rejected when the playlist is not restricted."""

    owner_id = uuid4()
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
        await service.add_share(
            row.id,
            user_id=owner_id,
            payload=PlaylistShareRequest(username="friend"),
        )

    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.asyncio
async def test_add_share_rejects_non_owner(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Only the owner can grant shares."""

    owner_id = uuid4()
    other_id = uuid4()
    row = _playlist(
        owner_id=owner_id,
        visibility=PlaylistVisibility.RESTRICTED,
    )
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
        await service.add_share(
            row.id,
            user_id=other_id,
            payload=PlaylistShareRequest(username="friend"),
        )

    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.asyncio
async def test_add_share_rejects_owner_username(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Owners cannot share a playlist with themselves."""

    owner_id = uuid4()
    row = _playlist(
        owner_id=owner_id,
        visibility=PlaylistVisibility.RESTRICTED,
    )
    session = _SessionSpy()
    repository = _FakeVideoRepository()
    repository.session = session
    service = PlaylistService(
        video_repository=cast(VideoRepository, repository),
    )
    owner_user = SimpleNamespace(
        id=owner_id,
        username="owner",
        display_name="Owner",
        is_active=True,
    )
    session.exec_results = [owner_user, None]

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
        await service.add_share(
            row.id,
            user_id=owner_id,
            payload=PlaylistShareRequest(username="owner"),
        )

    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.asyncio
async def test_add_share_creates_share_for_active_user(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Sharing with an active user persists a PlaylistShare row."""

    owner_id = uuid4()
    target_id = uuid4()
    row = _playlist(
        owner_id=owner_id,
        visibility=PlaylistVisibility.RESTRICTED,
    )
    session = _SessionSpy()
    repository = _FakeVideoRepository()
    repository.session = session
    service = PlaylistService(
        video_repository=cast(VideoRepository, repository),
    )
    target_user = SimpleNamespace(
        id=target_id,
        username="friend",
        display_name="Friend",
        is_active=True,
    )
    session.exec_results = [target_user, None]

    async def fake_get(
        _session: object,
        playlist_id: UUID,
    ) -> Optional[Playlist]:
        return row if playlist_id == row.id else None

    async def fake_get_for_user(
        _session: object,
        _playlist_id: UUID,
        _shared_with_user_id: UUID,
    ) -> None:
        return None

    monkeypatch.setattr(
        playlist_mod.Playlist,
        "get_by_id",
        staticmethod(fake_get),
    )
    monkeypatch.setattr(
        playlist_mod.PlaylistShare,
        "get_for_user",
        staticmethod(fake_get_for_user),
    )

    result = await service.add_share(
        row.id,
        user_id=owner_id,
        payload=PlaylistShareRequest(username="  friend  "),
    )

    assert result.user_id == target_id
    assert result.username == "friend"
    assert result.display_name == "Friend"
    assert session.committed == 1
    assert len(session.added) == 1


@pytest.mark.asyncio
async def test_add_share_idempotent_when_already_shared(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Re-sharing the same user returns the existing share."""

    owner_id = uuid4()
    target_id = uuid4()
    created_at = _now()
    row = _playlist(
        owner_id=owner_id,
        visibility=PlaylistVisibility.RESTRICTED,
    )
    session = _SessionSpy()
    repository = _FakeVideoRepository()
    repository.session = session
    service = PlaylistService(
        video_repository=cast(VideoRepository, repository),
    )
    target_user = SimpleNamespace(
        id=target_id,
        username="friend",
        display_name="Friend",
        is_active=True,
    )
    existing = SimpleNamespace(created_at=created_at)
    session.exec_results = [target_user, None]

    async def fake_get(
        _session: object,
        playlist_id: UUID,
    ) -> Optional[Playlist]:
        return row if playlist_id == row.id else None

    async def fake_get_for_user(
        _session: object,
        _playlist_id: UUID,
        shared_with_user_id: UUID,
    ) -> Any:
        assert shared_with_user_id == target_id

        return existing

    monkeypatch.setattr(
        playlist_mod.Playlist,
        "get_by_id",
        staticmethod(fake_get),
    )
    monkeypatch.setattr(
        playlist_mod.PlaylistShare,
        "get_for_user",
        staticmethod(fake_get_for_user),
    )

    result = await service.add_share(
        row.id,
        user_id=owner_id,
        payload=PlaylistShareRequest(username="friend"),
    )

    assert result.user_id == target_id
    assert result.created_at == created_at
    assert session.committed == 0
    assert not session.added


@pytest.mark.asyncio
async def test_add_share_rejects_unknown_user(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Missing or inactive targets yield HTTP 404."""

    owner_id = uuid4()
    row = _playlist(
        owner_id=owner_id,
        visibility=PlaylistVisibility.RESTRICTED,
    )
    session = _SessionSpy()
    repository = _FakeVideoRepository()
    repository.session = session
    service = PlaylistService(
        video_repository=cast(VideoRepository, repository),
    )

    session.exec_first = None

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
        await service.add_share(
            row.id,
            user_id=owner_id,
            payload=PlaylistShareRequest(username="ghost"),
        )

    assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.asyncio
async def test_list_shares_returns_shared_users(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """list_shares maps share rows to user summaries."""

    owner_id = uuid4()
    target_id = uuid4()
    row = _playlist(
        owner_id=owner_id,
        visibility=PlaylistVisibility.RESTRICTED,
    )
    created_at = _now()
    share = SimpleNamespace(
        shared_with_user_id=target_id,
        created_at=created_at,
    )
    target_user = SimpleNamespace(
        id=target_id,
        username="friend",
        display_name="Friend",
        is_active=True,
    )
    session = _SessionSpy()
    session.exec_results = [target_user, None]
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

    async def fake_list(
        _session: object,
        playlist_id: UUID,
    ) -> list[Any]:
        assert playlist_id == row.id

        return [share]

    monkeypatch.setattr(
        playlist_mod.Playlist,
        "get_by_id",
        staticmethod(fake_get),
    )
    monkeypatch.setattr(
        playlist_mod.PlaylistShare,
        "list_for_playlist",
        staticmethod(fake_list),
    )

    result = await service.list_shares(row.id, user_id=owner_id)

    assert result.total == 1
    assert result.items[0].user_id == target_id
    assert result.items[0].username == "friend"
    assert result.items[0].display_name == "Friend"


@pytest.mark.asyncio
async def test_remove_share_deletes_existing_grant(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """remove_share revokes an existing share."""

    owner_id = uuid4()
    target_id = uuid4()
    row = _playlist(
        owner_id=owner_id,
        visibility=PlaylistVisibility.RESTRICTED,
    )
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

    async def fake_revoke(
        _session: object,
        playlist_id: UUID,
        shared_with_user_id: UUID,
    ) -> bool:
        assert playlist_id == row.id
        assert shared_with_user_id == target_id

        return True

    monkeypatch.setattr(
        playlist_mod.Playlist,
        "get_by_id",
        staticmethod(fake_get),
    )
    monkeypatch.setattr(
        playlist_mod.PlaylistShare,
        "revoke",
        staticmethod(fake_revoke),
    )

    await service.remove_share(
        row.id,
        user_id=owner_id,
        shared_with_user_id=target_id,
    )


@pytest.mark.asyncio
async def test_remove_share_not_found(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Missing shares yield HTTP 404."""

    owner_id = uuid4()
    row = _playlist(
        owner_id=owner_id,
        visibility=PlaylistVisibility.RESTRICTED,
    )
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

    async def fake_revoke(
        _session: object,
        _playlist_id: UUID,
        _shared_with_user_id: UUID,
    ) -> bool:
        return False

    monkeypatch.setattr(
        playlist_mod.Playlist,
        "get_by_id",
        staticmethod(fake_get),
    )
    monkeypatch.setattr(
        playlist_mod.PlaylistShare,
        "revoke",
        staticmethod(fake_revoke),
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.remove_share(
            row.id,
            user_id=owner_id,
            shared_with_user_id=uuid4(),
        )

    assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND
