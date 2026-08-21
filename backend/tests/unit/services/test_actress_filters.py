"""Unit tests for actress list filter validation."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas.actress_filters import ActressListFilters, ActressSort


def test_actress_filters_accepts_empty() -> None:
    """Default filters are empty lists and null ranges."""

    filters = ActressListFilters()

    assert filters.cups == []
    assert filters.genres == []
    assert filters.age_min is None


def test_actress_filters_rejects_inverted_bust_range() -> None:
    """bust_min > bust_max is invalid."""

    with pytest.raises(ValidationError):
        ActressListFilters(bust_min=100, bust_max=80)


def test_actress_filters_rejects_age_below_18() -> None:
    """age_min must be at least 18."""

    with pytest.raises(ValidationError):
        ActressListFilters(age_min=17)


def test_actress_filters_normalizes_multi_value_fields() -> None:
    """Repeated catalog ids are kept as lists for OR semantics."""

    filters = ActressListFilters(
        cups=["O", "E"],
        genres=[10, 146],
        makers=[1],
        labels=[2, 3],
        directors=[9],
    )

    assert filters.cups == ["O", "E"]
    assert filters.genres == [10, 146]
    assert filters.labels == [2, 3]


def test_actress_sort_enum_values() -> None:
    """Sort codes match the public API contract."""

    assert ActressSort.CUP == 1
    assert ActressSort.VIEW_CNT == 9

    filters = ActressListFilters(sort=ActressSort.VIDEO_CNT)

    assert filters.sort == ActressSort.VIDEO_CNT
