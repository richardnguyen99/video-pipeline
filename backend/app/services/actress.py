"""Actress application service."""

# pylint: disable=too-many-locals

from typing import Optional

from fastapi import HTTPException, status
from pydantic import ValidationError

from app.repositories.actress import ActressRepository
from app.schemas.actress import ActressListResponse, ActressResponse
from app.schemas.actress_filters import ActressListFilters, ActressSort


class ActressService:
    """Business operations for actress resources."""

    def __init__(self, repository: ActressRepository) -> None:
        """Create an actress service.

        Args:
            repository: Actress data-access collaborator.
        """

        self._repository = repository

    def _to_actress_response(
        self,
        row: object,
        counts: dict[str, int],
    ) -> ActressResponse:
        """Map an ORM row and engagement totals into the public shape."""

        item = ActressResponse.model_validate(row)

        return item.model_copy(
            update={
                "video_cnt": counts.get("video_cnt", 0),
                "sub_cnt": counts.get("sub_cnt", 0),
                "view_cnt": counts.get("view_cnt", 0),
                "like_cnt": counts.get("like_cnt", 0),
                "comment_cnt": counts.get("comment_cnt", 0),
            },
        )

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
        sort: Optional[ActressSort] = None,
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
                sort=sort,
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
                {
                    "video_cnt": 0,
                    "sub_cnt": 0,
                    "view_cnt": 0,
                    "like_cnt": 0,
                    "comment_cnt": 0,
                },
            )
            items.append(self._to_actress_response(row, counts))

        return ActressListResponse(
            items=items,
            total=total,
            limit=safe_limit,
            offset=safe_offset,
        )

    async def get_actress(self, actress_id: int) -> ActressResponse:
        """Return one actress in the same shape as list items.

        Args:
            actress_id: Primary key.

        Returns:
            Public ``ActressResponse`` including engagement counts.

        Raises:
            HTTPException: 404 when the actress does not exist.
        """

        row = await self._repository.get_by_id(actress_id)

        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Actress not found",
            )

        engagement = await self._repository.count_engagement_for_actresses(
            [row.id],
        )
        counts = engagement.get(
            row.id,
            {
                "video_cnt": 0,
                "sub_cnt": 0,
                "view_cnt": 0,
                "like_cnt": 0,
                "comment_cnt": 0,
            },
        )

        return self._to_actress_response(row, counts)
