"""Content preference application service."""

from __future__ import annotations

import uuid

from fastapi import HTTPException, status
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

_ENTITY_MODELS = {
    PreferenceEntityType.ACTRESS.value: Actress,
    PreferenceEntityType.MAKER.value: Maker,
    PreferenceEntityType.GENRE.value: Genre,
    PreferenceEntityType.SERIES.value: Series,
    PreferenceEntityType.LABEL.value: Label,
    PreferenceEntityType.DIRECTOR.value: Director,
}


class ContentPreferenceService:
    """CRUD for per-user interest and dislike entity tags."""

    def __init__(self, session: AsyncSession) -> None:
        """Create a service bound to an async session."""

        self._session = session

    async def __resolve_entity_name(
        self,
        entity_type: str,
        entity_id: int,
    ) -> str:
        """Load the catalog entity display name or raise 404."""

        model = _ENTITY_MODELS.get(entity_type)

        if model is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported entity type.",
            )

        statement = select(model).where(col(model.id) == entity_id)
        result = await self._session.exec(statement)
        entity = result.first()

        if entity is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{entity_type.capitalize()} not found.",
            )

        name = getattr(entity, "name", None)

        if not isinstance(name, str) or not name.strip():
            return f"{entity_type}:{entity_id}"

        return name.strip()

    @staticmethod
    def __to_item(row: UserContentPreference) -> ContentPreferenceItem:
        """Map an ORM row to the API item schema."""

        return ContentPreferenceItem.model_validate(row)

    async def list_preferences(
        self,
        *,
        user_id: uuid.UUID,
    ) -> ContentPreferenceListResponse:
        """Return all interests and dislikes for the user."""

        rows = await UserContentPreference.list_for_user(
            self._session,
            user_id=user_id,
        )
        interests: list[ContentPreferenceItem] = []
        dislikes: list[ContentPreferenceItem] = []

        for row in rows:
            item = self.__to_item(row)

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
    ) -> ContentPreferenceItem:
        """Add or update a preference; opposite polarity replaces the row."""

        entity_name = await self.__resolve_entity_name(
            payload.entity_type,
            payload.entity_id,
        )
        existing = await UserContentPreference.get_by_user_and_entity(
            self._session,
            user_id=user_id,
            entity_type=payload.entity_type,
            entity_id=payload.entity_id,
        )

        if existing is not None:
            existing.polarity = payload.polarity
            existing.entity_name = entity_name
            self._session.add(existing)
            await self._session.commit()
            await self._session.refresh(existing)

            return self.__to_item(existing)

        row = UserContentPreference(
            user_id=user_id,
            polarity=payload.polarity,
            entity_type=payload.entity_type,
            entity_id=payload.entity_id,
            entity_name=entity_name,
        )
        self._session.add(row)
        await self._session.commit()
        await self._session.refresh(row)

        return self.__to_item(row)

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
