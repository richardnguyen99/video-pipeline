"""Genre application service."""

from typing import Optional

from fastapi import HTTPException, status

from app.models.genre import Genre, GenreAka
from app.repositories.genre import GenreRepository
from app.schemas.genre import (
    GenreAkaResponse,
    GenreDetailResponse,
    GenreResponse,
)


class GenreService:
    """Business operations for genre resources."""

    def __init__(self, repository: GenreRepository) -> None:
        """Create a genre service.

        Args:
            repository: Genre data-access collaborator.
        """

        self._repository = repository

    @staticmethod
    def _resolve_name(genre: Genre, locale_key: Optional[str]) -> str:
        """Resolve display name from locale aka or native Japanese name.

        Args:
            genre: Genre ORM row.
            locale_key: Normalized locale, or ``None`` when unset.

        Returns:
            ``genre_aka.translated_name`` for ``locale_key`` when present;
            otherwise ``genre.name``.
        """

        if locale_key is None:
            return genre.name

        akas: list[GenreAka] = list(getattr(genre, "genre_aka", None) or [])

        for aka in akas:
            if (aka.language or "").lower() != locale_key:
                continue

            translated = (aka.translated_name or "").strip()

            if translated != "":
                return translated

        return genre.name

    def _to_response(
        self,
        genre: Genre,
        locale_key: Optional[str],
    ) -> GenreResponse:
        """Map an ORM genre to the list response shape."""

        return GenreResponse(
            id=genre.id,
            name=self._resolve_name(genre, locale_key),
            ruby=genre.ruby,
            dmm_id=genre.dmm_id,
        )

    def _to_detail_response(self, genre: Genre) -> GenreDetailResponse:
        """Map an ORM genre to the detail response shape."""

        akas: list[GenreAka] = list(getattr(genre, "genre_aka", None) or [])
        aka_items = [
            GenreAkaResponse(
                id=aka.id,
                name=aka.translated_name,
                language=aka.language,
                created_at=aka.created_at,
                updated_at=aka.updated_at,
            )
            for aka in sorted(akas, key=lambda item: (item.language, item.id))
        ]

        return GenreDetailResponse(
            id=genre.id,
            name=genre.name,
            ruby=genre.ruby,
            dmm_id=genre.dmm_id,
            created_at=genre.created_at,
            updated_at=genre.updated_at,
            akas=aka_items,
        )

    async def list_genres(
        self,
        locale: Optional[str] = None,
    ) -> list[GenreResponse]:
        """Return all genres with locale-aware names.

        Args:
            locale: When omitted, ``name`` is native ``genre.name``.
                When set, ``name`` prefers matching
                ``genre_aka.translated_name``.

        Returns:
            Genre response items ordered by id.
        """

        locale_key: Optional[str] = None

        if locale is not None and locale.strip() != "":
            locale_key = locale.strip().lower()

        rows = await self._repository.list_genres(
            load_aka=locale_key is not None,
        )

        return [self._to_response(row, locale_key) for row in rows]

    async def get_genre(self, genre_id: int) -> GenreDetailResponse:
        """Return one genre with all aka translations.

        Args:
            genre_id: Genre primary key.

        Returns:
            Detailed genre payload (native Japanese ``name`` + ``akas``).

        Raises:
            HTTPException: 404 when the genre does not exist.
        """

        row = await self._repository.get_by_id(genre_id)

        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Genre not found",
            )

        return self._to_detail_response(row)
