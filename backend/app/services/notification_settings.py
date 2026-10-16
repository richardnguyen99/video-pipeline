"""User notification settings application service."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.user_notification_settings import UserNotificationSettings
from app.schemas.notification_settings import (
    NotificationSettingsResponse,
    NotificationSettingsUpdateRequest,
    PreferredLanguageLiteral,
)

_DEFAULT_LANGUAGE: PreferredLanguageLiteral = "en"


class NotificationSettingsService:
    """Read and update per-user notification preferences."""

    def __init__(self, session: AsyncSession) -> None:
        """Create a service bound to an async session."""

        self._session = session

    @staticmethod
    def __defaults() -> NotificationSettingsResponse:
        """Build the default settings payload when no row exists."""

        return NotificationSettingsResponse(
            id=None,
            preferred_language=_DEFAULT_LANGUAGE,
            notify_followed_videos=True,
            notify_public_video_activity=True,
            notify_public_playlist_activity=True,
            notify_comment_replies=True,
            created_at=None,
            updated_at=None,
        )

    @staticmethod
    def __to_response(
        row: UserNotificationSettings,
    ) -> NotificationSettingsResponse:
        """Map an ORM row to the API response schema."""

        return NotificationSettingsResponse.model_validate(row)

    async def get_settings(
        self,
        *,
        user_id: uuid.UUID,
    ) -> NotificationSettingsResponse:
        """Return settings for the user, or defaults when unset."""

        row = await UserNotificationSettings.get_by_user_id(
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
        payload: NotificationSettingsUpdateRequest,
    ) -> NotificationSettingsResponse:
        """Create or replace the user's notification settings."""

        now = datetime.now(timezone.utc).replace(tzinfo=None)
        row = await UserNotificationSettings.get_by_user_id(
            self._session,
            user_id=user_id,
        )

        if row is None:
            row = UserNotificationSettings(
                user_id=user_id,
                preferred_language=payload.preferred_language,
                notify_followed_videos=payload.notify_followed_videos,
                notify_public_video_activity=(
                    payload.notify_public_video_activity
                ),
                notify_public_playlist_activity=(
                    payload.notify_public_playlist_activity
                ),
                notify_comment_replies=payload.notify_comment_replies,
                created_at=now,
                updated_at=now,
            )
        else:
            row.preferred_language = payload.preferred_language
            row.notify_followed_videos = payload.notify_followed_videos
            row.notify_public_video_activity = (
                payload.notify_public_video_activity
            )
            row.notify_public_playlist_activity = (
                payload.notify_public_playlist_activity
            )
            row.notify_comment_replies = payload.notify_comment_replies
            row.updated_at = now

        self._session.add(row)
        await self._session.commit()
        await self._session.refresh(row)

        return self.__to_response(row)
