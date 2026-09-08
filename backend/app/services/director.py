"""Director application service."""

from typing import Optional

from fastapi import HTTPException, status

from app.models.director import Director, DirectorAka
from app.repositories.director import DirectorRepository
from app.schemas.director import (
    DirectorAkaResponse,
    DirectorDetailResponse,
    DirectorListResponse,
    DirectorResponse,
)

MAX_LIST_LIMIT = 100


class DirectorService:
    """Business operations for director resources."""

    def __init__(self, repository: DirectorRepository) -> None:
        """Create a director service.

        Args:
            repository: Director data-access collaborator.
        """

        self._repository = repository

    @staticmethod
    def _normalize_locale(locale: Optional[str]) -> Optional[str]:
        """Normalize locale query; empty becomes ``None``."""

        if locale is None or locale.strip() == "":
            return None

        return locale.strip().lower()

    @staticmethod
    def _resolve_name(director: Director, locale_key: Optional[str]) -> str:
        """Resolve display name from locale aka or native Japanese name.

        Args:
            director: Director ORM row.
            locale_key: Normalized locale, or ``None`` when unset.

        Returns:
            ``director_aka.translated_name`` for ``locale_key`` when present;
            otherwise ``director.name``.
        """

        if locale_key is None:
            return director.name

        akas: list[DirectorAka] = list(
            getattr(director, "director_aka", None) or [],
        )

        for aka in akas:
            if (aka.language or "").lower() != locale_key:
                continue

            translated = (aka.translated_name or "").strip()

            if translated != "":
                return translated

        return director.name

    def _to_response(
        self,
        director: Director,
        locale_key: Optional[str],
    ) -> DirectorResponse:
        """Map an ORM director to the list response shape."""

        return DirectorResponse(
            id=director.id,
            name=self._resolve_name(director, locale_key),
            ruby=director.ruby,
            dmm_id=director.dmm_id,
        )

    def _to_detail_response(
        self, director: Director
    ) -> DirectorDetailResponse:
        """Map an ORM director to the detail response shape."""

        akas: list[DirectorAka] = list(
            getattr(director, "director_aka", None) or [],
        )
        aka_items = [
            DirectorAkaResponse(
                id=aka.id,
                name=aka.translated_name,
                language=aka.language,
                created_at=aka.created_at,
                updated_at=aka.updated_at,
            )
            for aka in sorted(akas, key=lambda item: (item.language, item.id))
        ]

        return DirectorDetailResponse(
            id=director.id,
            name=director.name,
            ruby=director.ruby,
            dmm_id=director.dmm_id,
            created_at=director.created_at,
            updated_at=director.updated_at,
            akas=aka_items,
        )

    async def list_directors(
        self,
        locale: Optional[str] = None,
        q: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> DirectorListResponse:
        """Return a page of directors with optional search and locale names.

        Args:
            locale: When omitted, ``name`` is native ``director.name``.
                When set, ``name`` prefers matching
                ``director_aka.translated_name`` and search aka matches are
                scoped to that language.
            q: Optional multi-term search over name, ruby, and aka.
            limit: Page size (clamped to ``[1, 100]``).
            offset: Rows to skip (clamped to at least 0).

        Returns:
            Paginated ``DirectorListResponse``.
        """

        locale_key = self._normalize_locale(locale)
        safe_limit = min(MAX_LIST_LIMIT, max(1, limit))
        safe_offset = max(0, offset)

        rows = await self._repository.list_directors(
            q=q,
            locale_key=locale_key,
            load_aka=locale_key is not None,
            limit=safe_limit,
            offset=safe_offset,
        )
        total = await self._repository.count_directors(
            q=q,
            locale_key=locale_key,
        )

        return DirectorListResponse(
            items=[self._to_response(row, locale_key) for row in rows],
            total=total,
            limit=safe_limit,
            offset=safe_offset,
        )

    async def get_director(self, director_id: int) -> DirectorDetailResponse:
        """Return one director with all aka translations.

        Args:
            director_id: Director primary key.

        Returns:
            Detailed director payload (native Japanese ``name`` + ``akas``).

        Raises:
            HTTPException: 404 when the director does not exist.
        """

        row = await self._repository.get_by_id(director_id)

        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Director not found",
            )

        return self._to_detail_response(row)
