"""Maker application service."""

from typing import Optional

from fastapi import HTTPException, status

from app.models.maker import Maker, MakerAka
from app.repositories.maker import MakerRepository
from app.schemas.maker import (
    MakerAkaResponse,
    MakerDetailResponse,
    MakerListResponse,
    MakerResponse,
)

MAX_LIST_LIMIT = 100


class MakerService:
    """Business operations for maker resources."""

    def __init__(self, repository: MakerRepository) -> None:
        """Create a maker service.

        Args:
            repository: Maker data-access collaborator.
        """

        self._repository = repository

    @staticmethod
    def _normalize_locale(locale: Optional[str]) -> Optional[str]:
        """Normalize locale query; empty becomes ``None``."""

        if locale is None or locale.strip() == "":
            return None

        return locale.strip().lower()

    @staticmethod
    def _resolve_name(maker: Maker, locale_key: Optional[str]) -> str:
        """Resolve display name from locale aka or native Japanese name.

        Args:
            maker: Maker ORM row.
            locale_key: Normalized locale, or ``None`` when unset.

        Returns:
            ``maker_aka.translated_name`` for ``locale_key`` when present;
            otherwise ``maker.name``.
        """

        if locale_key is None:
            return maker.name

        akas: list[MakerAka] = list(getattr(maker, "maker_aka", None) or [])

        for aka in akas:
            if (aka.language or "").lower() != locale_key:
                continue

            translated = (aka.translated_name or "").strip()

            if translated != "":
                return translated

        return maker.name

    def _to_response(
        self,
        maker: Maker,
        locale_key: Optional[str],
    ) -> MakerResponse:
        """Map an ORM maker to the list response shape."""

        return MakerResponse(
            id=maker.id,
            name=self._resolve_name(maker, locale_key),
            ruby=maker.ruby,
            dmm_id=maker.dmm_id,
        )

    def _to_detail_response(self, maker: Maker) -> MakerDetailResponse:
        """Map an ORM maker to the detail response shape."""

        akas: list[MakerAka] = list(getattr(maker, "maker_aka", None) or [])
        aka_items = [
            MakerAkaResponse(
                id=aka.id,
                name=aka.translated_name,
                language=aka.language,
                created_at=aka.created_at,
                updated_at=aka.updated_at,
            )
            for aka in sorted(akas, key=lambda item: (item.language, item.id))
        ]

        return MakerDetailResponse(
            id=maker.id,
            name=maker.name,
            ruby=maker.ruby,
            dmm_id=maker.dmm_id,
            created_at=maker.created_at,
            updated_at=maker.updated_at,
            akas=aka_items,
        )

    async def list_makers(
        self,
        locale: Optional[str] = None,
        q: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> MakerListResponse:
        """Return a page of makers with optional search and locale names.

        Args:
            locale: When omitted, ``name`` is native ``maker.name``.
                When set, ``name`` prefers matching
                ``maker_aka.translated_name`` and search aka matches are
                scoped to that language.
            q: Optional multi-term search over name, ruby, and aka.
            limit: Page size (clamped to ``[1, 100]``).
            offset: Rows to skip (clamped to at least 0).

        Returns:
            Paginated ``MakerListResponse``.
        """

        locale_key = self._normalize_locale(locale)
        safe_limit = min(MAX_LIST_LIMIT, max(1, limit))
        safe_offset = max(0, offset)

        rows = await self._repository.list_makers(
            q=q,
            locale_key=locale_key,
            load_aka=locale_key is not None,
            limit=safe_limit,
            offset=safe_offset,
        )
        total = await self._repository.count_makers(
            q=q,
            locale_key=locale_key,
        )

        return MakerListResponse(
            items=[self._to_response(row, locale_key) for row in rows],
            total=total,
            limit=safe_limit,
            offset=safe_offset,
        )

    async def get_maker(self, maker_id: int) -> MakerDetailResponse:
        """Return one maker with all aka translations.

        Args:
            maker_id: Maker primary key.

        Returns:
            Detailed maker payload (native Japanese ``name`` + ``akas``).

        Raises:
            HTTPException: 404 when the maker does not exist.
        """

        row = await self._repository.get_by_id(maker_id)

        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Maker not found",
            )

        return self._to_detail_response(row)
