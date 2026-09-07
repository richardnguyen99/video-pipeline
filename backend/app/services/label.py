"""Label application service."""

from typing import Optional

from fastapi import HTTPException, status

from app.models.label import Label, LabelAka
from app.repositories.label import LabelRepository
from app.schemas.label import (
    LabelAkaResponse,
    LabelDetailResponse,
    LabelListResponse,
    LabelResponse,
)

MAX_LIST_LIMIT = 100


class LabelService:
    """Business operations for label resources."""

    def __init__(self, repository: LabelRepository) -> None:
        """Create a label service.

        Args:
            repository: Label data-access collaborator.
        """

        self._repository = repository

    @staticmethod
    def _normalize_locale(locale: Optional[str]) -> Optional[str]:
        """Normalize locale query; empty becomes ``None``."""

        if locale is None or locale.strip() == "":
            return None

        return locale.strip().lower()

    @staticmethod
    def _resolve_name(label: Label, locale_key: Optional[str]) -> str:
        """Resolve display name from locale aka or native Japanese name.

        Args:
            label: Label ORM row.
            locale_key: Normalized locale, or ``None`` when unset.

        Returns:
            ``label_aka.translated_name`` for ``locale_key`` when present;
            otherwise ``label.name``.
        """

        if locale_key is None:
            return label.name

        akas: list[LabelAka] = list(getattr(label, "label_aka", None) or [])

        for aka in akas:
            if (aka.language or "").lower() != locale_key:
                continue

            translated = (aka.translated_name or "").strip()

            if translated != "":
                return translated

        return label.name

    def _to_response(
        self,
        label: Label,
        locale_key: Optional[str],
    ) -> LabelResponse:
        """Map an ORM label to the list response shape."""

        return LabelResponse(
            id=label.id,
            name=self._resolve_name(label, locale_key),
            ruby=label.ruby,
            dmm_id=label.dmm_id,
        )

    def _to_detail_response(self, label: Label) -> LabelDetailResponse:
        """Map an ORM label to the detail response shape."""

        akas: list[LabelAka] = list(getattr(label, "label_aka", None) or [])
        aka_items = [
            LabelAkaResponse(
                id=aka.id,
                name=aka.translated_name,
                language=aka.language,
                created_at=aka.created_at,
                updated_at=aka.updated_at,
            )
            for aka in sorted(akas, key=lambda item: (item.language, item.id))
        ]

        return LabelDetailResponse(
            id=label.id,
            name=label.name,
            ruby=label.ruby,
            dmm_id=label.dmm_id,
            created_at=label.created_at,
            updated_at=label.updated_at,
            akas=aka_items,
        )

    async def list_labels(
        self,
        locale: Optional[str] = None,
        q: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> LabelListResponse:
        """Return a page of labels with optional search and locale names.

        Args:
            locale: When omitted, ``name`` is native ``label.name``.
                When set, ``name`` prefers matching
                ``label_aka.translated_name`` and search aka matches are
                scoped to that language.
            q: Optional multi-term search over name, ruby, and aka.
            limit: Page size (clamped to ``[1, 100]``).
            offset: Rows to skip (clamped to at least 0).

        Returns:
            Paginated ``LabelListResponse``.
        """

        locale_key = self._normalize_locale(locale)
        safe_limit = min(MAX_LIST_LIMIT, max(1, limit))
        safe_offset = max(0, offset)

        rows = await self._repository.list_labels(
            q=q,
            locale_key=locale_key,
            load_aka=locale_key is not None,
            limit=safe_limit,
            offset=safe_offset,
        )
        total = await self._repository.count_labels(
            q=q,
            locale_key=locale_key,
        )

        return LabelListResponse(
            items=[self._to_response(row, locale_key) for row in rows],
            total=total,
            limit=safe_limit,
            offset=safe_offset,
        )

    async def get_label(self, label_id: int) -> LabelDetailResponse:
        """Return one label with all aka translations.

        Args:
            label_id: Label primary key.

        Returns:
            Detailed label payload (native Japanese ``name`` + ``akas``).

        Raises:
            HTTPException: 404 when the label does not exist.
        """

        row = await self._repository.get_by_id(label_id)

        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Label not found",
            )

        return self._to_detail_response(row)
