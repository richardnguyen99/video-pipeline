"""Actress application service."""

from app.repositories.actress import ActressRepository
from app.schemas.actress import ActressListResponse, ActressResponse


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
    ) -> ActressListResponse:
        """List actresses with simple offset pagination.

        Args:
            limit: Page size (clamped to at least 1).
            offset: Rows to skip (clamped to at least 0).

        Returns:
            An ``ActressListResponse`` with items and totals.
        """

        safe_limit = max(1, limit)
        safe_offset = max(0, offset)

        rows = await self._repository.list_actresses(
            limit=safe_limit,
            offset=safe_offset,
        )
        total = await self._repository.count_actresses()

        items = [ActressResponse.model_validate(row) for row in rows]

        return ActressListResponse(
            items=items,
            total=total,
            limit=safe_limit,
            offset=safe_offset,
        )
