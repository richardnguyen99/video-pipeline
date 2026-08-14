"""Video list query filters and sort values (frontend discover parity)."""

from enum import StrEnum
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class VideoSort(StrEnum):
    """Allowed ``sort`` query values for video discovery."""

    TRENDING_WEEK = "trending-week"
    TRENDING_MONTH = "trending-month"
    TRENDING_ALL = "trending-all"
    LATEST = "latest"
    VIEWS = "views"
    LIKES = "likes"


class FeaturesCountRange(BaseModel):
    """Actress feature-count range filter.

    Examples from the query string ``features_cnt``:
    - ``2`` → min=2, max=2 (exact)
    - ``3,`` → min=3, max=None (3 or more)
    - ``1,3`` → min=1, max=3
    """

    min: int = Field(ge=0)
    max: Optional[int] = Field(default=None, ge=0)

    @field_validator("max")
    @classmethod
    def max_gte_min(
        cls,
        value: Optional[int],
        info: object,
    ) -> Optional[int]:
        """Reject ranges where max is below min."""

        data = getattr(info, "data", {}) or {}
        minimum = data.get("min")

        if value is not None and minimum is not None and value < minimum:
            raise ValueError("features_cnt max must be >= min")

        return value


class VideoListFilters(BaseModel):
    """Normalized filters applied to video list queries."""

    actress: list[int] = Field(default_factory=list)
    genre: list[int] = Field(default_factory=list)
    maker: Optional[int] = None
    label: Optional[int] = None
    director: Optional[int] = None
    series: Optional[int] = None
    features_cnt: Optional[FeaturesCountRange] = None
    sort: VideoSort = VideoSort.TRENDING_WEEK


def parse_features_cnt(raw: str) -> FeaturesCountRange:
    """Parse a ``features_cnt`` query string into a range.

    Args:
        raw: One of ``N``, ``N,``, or ``N,M``.

    Returns:
        A ``FeaturesCountRange``.

    Raises:
        ValueError: When the string is not a valid range form.
    """

    text = raw.strip()

    if not text:
        raise ValueError("features_cnt must not be empty")

    if "," not in text:
        value = int(text)

        if value < 0:
            raise ValueError("features_cnt must be >= 0")

        return FeaturesCountRange(min=value, max=value)

    left, right = text.split(",", 1)
    left = left.strip()
    right = right.strip()

    if not left:
        raise ValueError("features_cnt min is required")

    minimum = int(left)

    if minimum < 0:
        raise ValueError("features_cnt min must be >= 0")

    if right == "":
        return FeaturesCountRange(min=minimum, max=None)

    maximum = int(right)

    if maximum < 0:
        raise ValueError("features_cnt max must be >= 0")

    return FeaturesCountRange(min=minimum, max=maximum)
