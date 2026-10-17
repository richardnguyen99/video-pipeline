"""Account soft-deactivation application service."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.repositories.refresh_token import RefreshTokenRepository
from app.repositories.user import UserRepository
from app.schemas.account_deactivate import DeactivateAccountResponse


class AccountDeactivateService:
    """Soft-deactivate accounts and end all active sessions."""

    def __init__(
        self,
        session: AsyncSession,
        *,
        users: UserRepository,
        refresh_tokens: RefreshTokenRepository,
    ) -> None:
        """Create a service bound to repositories sharing one session."""

        self._session = session
        self._users = users
        self._refresh_tokens = refresh_tokens

    async def deactivate(
        self,
        *,
        user_id: uuid.UUID,
    ) -> DeactivateAccountResponse:
        """Mark the account inactive and revoke every refresh session.

        Related rows (comments, playlists, preferences, etc.) are left
        unchanged. Login and authenticated API access are blocked while
        ``is_active`` is false.
        """

        user = await self._users.get_by_id(user_id)

        if user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found.",
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Account is already deactivated.",
            )

        now = datetime.now(timezone.utc).replace(tzinfo=None)
        user.is_active = False
        user.deactivated_at = now
        user.updated_at = now

        self._session.add(user)
        await self._session.commit()
        await self._session.refresh(user)

        await self._refresh_tokens.revoke_all_for_user(user_id)
        await self._users.bump_sessions_revoked_at(user_id)

        return DeactivateAccountResponse(
            id=user.id,
            username=user.username,
            is_active=user.is_active,
            deactivated_at=user.deactivated_at or now,
        )
