"""Series application service."""

from typing import Optional

from app.models.series import Series, SeriesAka
from app.repositories.series import SeriesRepository
from app.schemas.series import SeriesListResponse, SeriesResponse

MAX_LIST_LIMIT = 100


class SeriesService:
    """Business operations for series resources."""

    def __init__(self, repository: SeriesRepository) -> None:
        """Create a series service.

        Args:
            repository: Series data-access collaborator.
        """

        self._repository = repository

    @staticmethod
    def _normalize_locale(locale: Optional[str]) -> Optional[str]:
        """Normalize locale query; empty becomes ``None``."""

        if locale is None or locale.strip() == "":
            return None

        return locale.strip().lower()

    @staticmethod
    def _resolve_name(series: Series, locale_key: Optional[str]) -> str:
        """Resolve display name from locale aka or native Japanese name."""

        if locale_key is None:
            return series.name

        akas: list[SeriesAka] = list(getattr(series, "series_aka", None) or [])

        for aka in akas:
            if (aka.language or "").lower() != locale_key:
                continue

            translated = (aka.translated_name or "").strip()

            if translated != "":
                return translated

        return series.name

    def _to_response(
        self,
        series: Series,
        locale_key: Optional[str],
    ) -> SeriesResponse:
        """Map an ORM series to the list response shape."""

        return SeriesResponse(
            id=series.id,
            name=self._resolve_name(series, locale_key),
            ruby=series.ruby,
            dmm_id=series.dmm_id,
        )

    async def list_series(
        self,
        locale: Optional[str] = None,
        q: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> SeriesListResponse:
        """Return a page of series with optional search and locale names.

        Args:
            locale: When omitted, ``name`` is native ``series.name``.
                When set, ``name`` prefers matching
                ``series_aka.translated_name`` and search aka matches are
                scoped to that language.
            q: Optional multi-term search over name, ruby, and aka.
            limit: Page size (clamped to ``[1, 100]``).
            offset: Rows to skip (clamped to at least 0).

        Returns:
            Paginated ``SeriesListResponse``.
        """

        locale_key = self._normalize_locale(locale)
        safe_limit = min(MAX_LIST_LIMIT, max(1, limit))
        safe_offset = max(0, offset)

        rows = await self._repository.list_series(
            q=q,
            locale_key=locale_key,
            load_aka=locale_key is not None,
            limit=safe_limit,
            offset=safe_offset,
        )
        total = await self._repository.count_series(
            q=q,
            locale_key=locale_key,
        )

        return SeriesListResponse(
            items=[self._to_response(row, locale_key) for row in rows],
            total=total,
            limit=safe_limit,
            offset=safe_offset,
        )
