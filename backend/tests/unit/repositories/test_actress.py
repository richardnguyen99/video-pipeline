"""Unit tests for ``ActressRepository`` engagement aggregates."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.repositories.actress import ActressRepository


def _result_with_rows(rows: list[tuple[int, int]]) -> MagicMock:
    """Build a query result mock whose ``.all()`` returns ``rows``."""

    result = MagicMock()
    result.all.return_value = rows

    return result


@pytest.fixture
def session() -> AsyncMock:
    """Async session with configurable ``execute`` / ``exec`` results."""

    return AsyncMock()


@pytest.fixture
def repository(session: AsyncMock) -> ActressRepository:
    """Repository under test."""

    return ActressRepository(session=session)


@pytest.mark.asyncio
async def test_count_engagement_empty_ids_returns_empty(
    repository: ActressRepository,
    session: AsyncMock,
) -> None:
    """No actress ids → no queries and empty mapping."""

    result = await repository.count_engagement_for_actresses([])

    assert result == {}
    session.execute.assert_not_called()
    session.exec.assert_not_called()


@pytest.mark.asyncio
async def test_count_engagement_defaults_missing_ids_to_zero(
    repository: ActressRepository,
    session: AsyncMock,
) -> None:
    """Ids with no aggregate rows still appear with zero counts."""

    session.execute = AsyncMock(
        side_effect=[
            _result_with_rows([]),  # video_cnt
            _result_with_rows([]),  # view_cnt
        ],
    )
    session.exec = AsyncMock(return_value=_result_with_rows([]))

    result = await repository.count_engagement_for_actresses([1, 2])

    assert result == {
        1: {"video_cnt": 0, "sub_cnt": 0, "view_cnt": 0},
        2: {"video_cnt": 0, "sub_cnt": 0, "view_cnt": 0},
    }
    assert session.execute.await_count == 2
    assert session.exec.await_count == 1


@pytest.mark.asyncio
async def test_count_engagement_maps_video_sub_and_view_totals(
    repository: ActressRepository,
    session: AsyncMock,
) -> None:
    """Grouped query rows fill video_cnt, sub_cnt, and view_cnt."""

    # execute: video_actress counts, then view counts
    session.execute = AsyncMock(
        side_effect=[
            _result_with_rows([(1, 12), (2, 3)]),
            _result_with_rows([(1, 100), (3, 7)]),
        ],
    )
    # exec: subscription counts
    session.exec = AsyncMock(
        return_value=_result_with_rows([(1, 5), (2, 1)]),
    )

    result = await repository.count_engagement_for_actresses([1, 2, 3])

    assert result[1] == {"video_cnt": 12, "sub_cnt": 5, "view_cnt": 100}
    assert result[2] == {"video_cnt": 3, "sub_cnt": 1, "view_cnt": 0}
    assert result[3] == {"video_cnt": 0, "sub_cnt": 0, "view_cnt": 7}


@pytest.mark.asyncio
async def test_count_engagement_coerces_row_types(
    repository: ActressRepository,
    session: AsyncMock,
) -> None:
    """String/numeric driver values are normalized to int."""

    session.execute = AsyncMock(
        side_effect=[
            _result_with_rows([(10, 4)]),
            _result_with_rows([(10, 9)]),
        ],
    )
    session.exec = AsyncMock(return_value=_result_with_rows([(10, 2)]))

    result = await repository.count_engagement_for_actresses([10])

    assert result[10]["video_cnt"] == 4
    assert result[10]["sub_cnt"] == 2
    assert result[10]["view_cnt"] == 9
