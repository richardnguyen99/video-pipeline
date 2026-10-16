"""Content preference application service."""

from __future__ import annotations

import uuid
from typing import Any, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import selectinload
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.actress import Actress
from app.models.director import Director
from app.models.genre import Genre
from app.models.label import Label
from app.models.maker import Maker
from app.models.series import Series
from app.models.user_content_preference import (
    PreferenceEntityType,
    PreferencePolarity,
    UserContentPreference,
)
from app.schemas.content_preference import (
    ContentPreferenceCreateRequest,
    ContentPreferenceItem,
    ContentPreferenceListResponse,
)
from app.utils import relationship_attr

_DEFAULT_LOCALE = "en-us"

_ENTITY_MODELS: dict[str, type[Any]] = {
    PreferenceEntityType.ACTRESS.value: Actress,
    PreferenceEntityType.MAKER.value: Maker,
    PreferenceEntityType.GENRE.value: Genre,
    PreferenceEntityType.SERIES.value: Series,
    PreferenceEntityType.LABEL.value: Label,
    PreferenceEntityType.DIRECTOR.value: Director,
}

_AKA_RELATION: dict[str, str] = {
    PreferenceEntityType.ACTRESS.value: "actress_aka",
    PreferenceEntityType.MAKER.value: "maker_aka",
    PreferenceEntityType.GENRE.value: "genre_aka",
    PreferenceEntityType.SERIES.value: "series_aka",
    PreferenceEntityType.LABEL.value: "label_aka",
    PreferenceEntityType.DIRECTOR.value: "director_aka",
}


class ContentPreferenceService:
    """CRUD for per-user interest and dislike entity tags."""

    def __init__(self, session: AsyncSession) -> None:
        """Create a service bound to an async session."""

        self._session = session

    @staticmethod
    def __normalize_locale(locale: Optional[str]) -> str:
        """Normalize locale; empty falls back to the default display locale."""

        if locale is None or locale.strip() == "":
            return _DEFAULT_LOCALE

        return locale.strip().lower()

    @staticmethod
    def __resolve_display_name(
        entity: Any,
        *,
        entity_type: str,
        locale_key: str,
    ) -> str:
        """Prefer aka translated name for ``locale_key``, else native name."""

        native = getattr(entity, "name", None)
        native_name = native.strip() if isinstance(native, str) else ""
        aka_attr = _AKA_RELATION.get(entity_type)
        akas_raw = getattr(entity, aka_attr, None) if aka_attr else None

        if akas_raw is None:
            return native_name or f"{entity_type}:{getattr(entity, 'id', '?')}"

        if not isinstance(akas_raw, list):
            akas: list[Any] = [akas_raw]
        else:
            akas = list(akas_raw)

        candidates = [locale_key]

        if locale_key.startswith("en") and "en" not in candidates:
            candidates.append("en")

        for candidate in candidates:
            for aka in akas:
                language = (getattr(aka, "language", None) or "").lower()

                if language != candidate:
                    continue

                translated = (
                    getattr(aka, "translated_name", None) or ""
                ).strip()

                if translated != "":
                    return translated

        # Any non-empty translated name as last resort before native Japanese.
        for aka in akas:
            translated = (getattr(aka, "translated_name", None) or "").strip()

            if translated != "":
                return translated

        if native_name != "":
            return native_name

        return f"{entity_type}:{getattr(entity, 'id', '?')}"

    async def __load_entity(
        self,
        entity_type: str,
        entity_id: int,
    ) -> Any:
        """Load a catalog entity with aka rows or raise 404."""

        model = _ENTITY_MODELS.get(entity_type)

        if model is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported entity type.",
            )

        aka_attr = _AKA_RELATION.get(entity_type)
        statement = select(model).where(col(model.id) == entity_id)

        if aka_attr is not None:
            aka_relationship = getattr(model, aka_attr)
            statement = statement.options(
                selectinload(relationship_attr(aka_relationship)),
            )

        result = await self._session.exec(statement)
        entity = result.first()

        if entity is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{entity_type.capitalize()} not found.",
            )

        return entity

    async def __resolve_entity_name(
        self,
        entity_type: str,
        entity_id: int,
        *,
        locale: Optional[str] = None,
    ) -> str:
        """Load the catalog entity and return the preferred display name."""

        entity = await self.__load_entity(entity_type, entity_id)
        locale_key = self.__normalize_locale(locale)

        return self.__resolve_display_name(
            entity,
            entity_type=entity_type,
            locale_key=locale_key,
        )

    @staticmethod
    def __to_item(
        row: UserContentPreference,
        *,
        entity_name: str,
    ) -> ContentPreferenceItem:
        """Map an ORM row plus resolved display name to the API item schema."""

        return ContentPreferenceItem.model_validate(
            {
                "id": row.id,
                "polarity": row.polarity,
                "entity_type": row.entity_type,
                "entity_id": row.entity_id,
                "entity_name": entity_name,
                "created_at": row.created_at,
            }
        )

    async def list_preferences(
        self,
        *,
        user_id: uuid.UUID,
        locale: Optional[str] = None,
    ) -> ContentPreferenceListResponse:
        """Return all interests and dislikes for the user.

        Display names are resolved at read time by joining the catalog entity
        (and aka rows) for ``locale`` (default ``en-us``).
        """

        rows = await UserContentPreference.list_for_user(
            self._session,
            user_id=user_id,
        )
        locale_key = self.__normalize_locale(locale)
        interests: list[ContentPreferenceItem] = []
        dislikes: list[ContentPreferenceItem] = []

        for row in rows:
            try:
                display_name = await self.__resolve_entity_name(
                    row.entity_type,
                    row.entity_id,
                    locale=locale_key,
                )
            except HTTPException:
                display_name = f"{row.entity_type}:{row.entity_id}"

            item = self.__to_item(row, entity_name=display_name)

            if row.polarity == PreferencePolarity.INTEREST.value:
                interests.append(item)
            elif row.polarity == PreferencePolarity.DISLIKE.value:
                dislikes.append(item)

        return ContentPreferenceListResponse(
            interests=interests,
            dislikes=dislikes,
        )

    async def upsert_preference(
        self,
        *,
        user_id: uuid.UUID,
        payload: ContentPreferenceCreateRequest,
        locale: Optional[str] = None,
    ) -> ContentPreferenceItem:
        """Add or update a preference; opposite polarity replaces the row."""

        # Validate the catalog entity exists and resolve display name for the
        # response payload only (name is not persisted).
        entity_name = await self.__resolve_entity_name(
            payload.entity_type,
            payload.entity_id,
            locale=locale,
        )
        existing = await UserContentPreference.get_by_user_and_entity(
            self._session,
            user_id=user_id,
            entity_type=payload.entity_type,
            entity_id=payload.entity_id,
        )

        if existing is not None:
            existing.polarity = payload.polarity
            self._session.add(existing)
            await self._session.commit()
            await self._session.refresh(existing)

            return self.__to_item(existing, entity_name=entity_name)

        row = UserContentPreference(
            user_id=user_id,
            polarity=payload.polarity,
            entity_type=payload.entity_type,
            entity_id=payload.entity_id,
        )
        self._session.add(row)
        await self._session.commit()
        await self._session.refresh(row)

        return self.__to_item(row, entity_name=entity_name)

    async def remove_preference(
        self,
        *,
        user_id: uuid.UUID,
        entity_type: str,
        entity_id: int,
    ) -> None:
        """Delete a preference for the given entity, if present."""

        existing = await UserContentPreference.get_by_user_and_entity(
            self._session,
            user_id=user_id,
            entity_type=entity_type,
            entity_id=entity_id,
        )

        if existing is None:
            return

        await self._session.delete(existing)
        await self._session.commit()

    async def clear_polarity(
        self,
        *,
        user_id: uuid.UUID,
        polarity: str,
    ) -> None:
        """Remove every preference of the given polarity."""

        if polarity not in {
            PreferencePolarity.INTEREST.value,
            PreferencePolarity.DISLIKE.value,
        }:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid polarity.",
            )

        rows = await UserContentPreference.list_for_user(
            self._session,
            user_id=user_id,
            polarity=polarity,
        )

        for row in rows:
            await self._session.delete(row)

        await self._session.commit()
