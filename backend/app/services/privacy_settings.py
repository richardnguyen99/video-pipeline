"""User privacy settings application service."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.user_privacy_settings import UserPrivacySettings
from app.schemas.privacy_settings import (
    PrivacySettingsResponse,
    PrivacySettingsUpdateRequest,
)


class PrivacySettingsService:
    """Read and update per-user privacy preferences."""

    def __init__(self, session: AsyncSession) -> None:
        """Create a service bound to an async session."""

        self._session = session

    @staticmethod
    def __defaults() -> PrivacySettingsResponse:
        """Build the default settings payload when no row exists."""

        return PrivacySettingsResponse(
            id=None,
            show_watched_videos=False,
            show_liked_videos=False,
            show_subscriptions=True,
            show_comment_history=True,
            created_at=None,
            updated_at=None,
        )

    @staticmethod
    def __to_response(
        row: UserPrivacySettings,
    ) -> PrivacySettingsResponse:
        """Map an ORM row to the API response schema."""

        return PrivacySettingsResponse.model_validate(row)

    async def get_settings(
        self,
        *,
        user_id: uuid.UUID,
    ) -> PrivacySettingsResponse:
        """Return settings for the user, or defaults when unset."""

        row = await UserPrivacySettings.get_by_user_id(
            self._session,
            user_id=user_id,
        )

        if row is None:
            return self.__defaults()

        return self.__to_response(row)

    async def update_settings(
        self,
        *,
        user_id: uuid.UUID,
        payload: PrivacySettingsUpdateRequest,
    ) -> PrivacySettingsResponse:
        """Create or replace the user's privacy settings."""

        now = datetime.now(timezone.utc).replace(tzinfo=None)
        row = await UserPrivacySettings.get_by_user_id(
            self._session,
            user_id=user_id,
        )

        if row is None:
            row = UserPrivacySettings(
                user_id=user_id,
                show_watched_videos=payload.show_watched_videos,
                show_liked_videos=payload.show_liked_videos,
                show_subscriptions=payload.show_subscriptions,
                show_comment_history=payload.show_comment_history,
                created_at=now,
                updated_at=now,
            )
        else:
            row.show_watched_videos = payload.show_watched_videos
            row.show_liked_videos = payload.show_liked_videos
            row.show_subscriptions = payload.show_subscriptions
            row.show_comment_history = payload.show_comment_history
            row.updated_at = now

        self._session.add(row)
        await self._session.commit()
        await self._session.refresh(row)

        return self.__to_response(row)
