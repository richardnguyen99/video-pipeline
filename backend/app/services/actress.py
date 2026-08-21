"""Actress application service."""

# pylint: disable=too-many-locals

from typing import Optional

from fastapi import HTTPException, status
from pydantic import ValidationError

from app.repositories.actress import ActressRepository
from app.schemas.actress import ActressListResponse, ActressResponse
from app.schemas.actress_filters import ActressListFilters


class ActressService:
    """Business operations for actress resources."""

    def __init__(self, repository: ActressRepository) -> None:
        """Create an actress service.

        Args:
            repository: Actress data-access collaborator.
        """

        self._repository = repository

    async def list_actresses(
        self,
        *,
        limit: int = 20,
        offset: int = 0,
        cups: Optional[list[str]] = None,
        bust_min: Optional[int] = None,
        bust_max: Optional[int] = None,
        waist_min: Optional[int] = None,
        waist_max: Optional[int] = None,
        hip_min: Optional[int] = None,
        hip_max: Optional[int] = None,
        height_min: Optional[int] = None,
        height_max: Optional[int] = None,
        age_min: Optional[int] = None,
        age_max: Optional[int] = None,
        genres: Optional[list[int]] = None,
        makers: Optional[list[int]] = None,
        series: Optional[list[int]] = None,
        labels: Optional[list[int]] = None,
        directors: Optional[list[int]] = None,
    ) -> ActressListResponse:
        """Return a paginated actress list with filters and engagement counts.

        Args:
            limit: Page size (clamped to at least 1).
            offset: Rows to skip (clamped to at least 0).
            cups: Cup sizes (OR).
            bust_min / bust_max: Bust range.
            waist_min / waist_max: Waist range.
            hip_min / hip_max: Hip range.
            height_min / height_max: Height range.
            age_min / age_max: Age range derived from birthday.
            genres / makers / series / labels / directors: Catalog OR filters
                via featured videos.

        Returns:
            An ``ActressListResponse`` with items and totals.

        Raises:
            HTTPException: 400 when a min/max range is inverted.
        """

        safe_limit = max(1, limit)
        safe_offset = max(0, offset)

        try:
            filters = ActressListFilters(
                cups=list(cups or []),
                bust_min=bust_min,
                bust_max=bust_max,
                waist_min=waist_min,
                waist_max=waist_max,
                hip_min=hip_min,
                hip_max=hip_max,
                height_min=height_min,
                height_max=height_max,
                age_min=age_min,
                age_max=age_max,
                genres=list(genres or []),
                makers=list(makers or []),
                series=list(series or []),
                labels=list(labels or []),
                directors=list(directors or []),
            )
        except ValidationError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=exc.errors(),
            ) from exc

        rows = await self._repository.list_actresses(
            filters=filters,
            limit=safe_limit,
            offset=safe_offset,
        )
        total = await self._repository.count_actresses(filters=filters)
        engagement = await self._repository.count_engagement_for_actresses(
            [row.id for row in rows],
        )

        items: list[ActressResponse] = []

        for row in rows:
            counts = engagement.get(
                row.id,
                {"video_cnt": 0, "sub_cnt": 0, "view_cnt": 0},
            )
            item = ActressResponse.model_validate(row)
            items.append(
                item.model_copy(
                    update={
                        "video_cnt": counts["video_cnt"],
                        "sub_cnt": counts["sub_cnt"],
                        "view_cnt": counts["view_cnt"],
                    },
                ),
            )

        return ActressListResponse(
            items=items,
            total=total,
            limit=safe_limit,
            offset=safe_offset,
        )
