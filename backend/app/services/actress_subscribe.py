"""Actress subscription application service."""

from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlmodel import col, select

from app.models.actress import Actress
from app.models.user import User
from app.models.user_actress_subscribe import UserActressSubscribe
from app.repositories.actress import ActressRepository
from app.schemas.actress_subscribe import (
    ActressSubscribeItem,
    ActressSubscribeListResponse,
    ActressSubscribeStatusResponse,
)


class ActressSubscribeService:
    """Business operations for user-to-actress subscriptions."""

    def __init__(self, repository: ActressRepository) -> None:
        """Create a subscribe service.

        Args:
            repository: Shared actress data-access collaborator.
        """

        self._repository = repository

    @property
    def _session(self):
        """Return the bound async session."""

        return self._repository.session

    async def _require_actress(self, actress_id: int) -> Actress:
        """Load an actress or raise 404."""

        actress = await self._repository.get_by_id(actress_id)

        if actress is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Actress not found",
            )

        return actress

    async def subscribe(
        self,
        *,
        user_id: uuid.UUID,
        actress_id: int,
    ) -> ActressSubscribeStatusResponse:
        """Subscribe the authenticated user to an actress (idempotent)."""

        await self._require_actress(actress_id)
        await UserActressSubscribe.subscribe(
            self._session,
            user_id=user_id,
            actress_id=actress_id,
        )
        sub_cnt = await UserActressSubscribe.count_for_actress(
            self._session,
            actress_id,
        )

        return ActressSubscribeStatusResponse(
            actress_id=actress_id,
            is_subscribed=True,
            sub_cnt=sub_cnt,
        )

    async def unsubscribe(
        self,
        *,
        user_id: uuid.UUID,
        actress_id: int,
    ) -> ActressSubscribeStatusResponse:
        """Remove the authenticated user's subscription when present."""

        await self._require_actress(actress_id)
        await UserActressSubscribe.unsubscribe(
            self._session,
            user_id=user_id,
            actress_id=actress_id,
        )
        sub_cnt = await UserActressSubscribe.count_for_actress(
            self._session,
            actress_id,
        )

        return ActressSubscribeStatusResponse(
            actress_id=actress_id,
            is_subscribed=False,
            sub_cnt=sub_cnt,
        )

    async def get_status(
        self,
        *,
        user_id: uuid.UUID,
        actress_id: int,
    ) -> ActressSubscribeStatusResponse:
        """Return whether the user is subscribed and the public sub count."""

        await self._require_actress(actress_id)
        existing = await UserActressSubscribe.get_by_user_and_actress(
            self._session,
            user_id=user_id,
            actress_id=actress_id,
        )
        sub_cnt = await UserActressSubscribe.count_for_actress(
            self._session,
            actress_id,
        )

        return ActressSubscribeStatusResponse(
            actress_id=actress_id,
            is_subscribed=existing is not None,
            sub_cnt=sub_cnt,
        )

    async def list_for_user(
        self,
        *,
        user_id: uuid.UUID,
        limit: int = 20,
        offset: int = 0,
    ) -> ActressSubscribeListResponse:
        """List actresses the user is subscribed to (newest first)."""

        safe_limit = max(1, min(limit, 100))
        safe_offset = max(0, offset)
        rows = await UserActressSubscribe.list_for_user(
            self._session,
            user_id,
            limit=safe_limit,
            offset=safe_offset,
        )
        total = await UserActressSubscribe.count_for_user(
            self._session,
            user_id,
        )

        if not rows:
            return ActressSubscribeListResponse(
                items=[],
                total=total,
                limit=safe_limit,
                offset=safe_offset,
            )

        actress_ids = [row.actress_id for row in rows]
        statement = select(Actress).where(col(Actress.id).in_(actress_ids))
        actress_rows = (await self._session.exec(statement)).all()
        actress_by_id = {actress.id: actress for actress in actress_rows}

        items: list[ActressSubscribeItem] = []

        for row in rows:
            actress = actress_by_id.get(row.actress_id)

            if actress is None:
                continue

            items.append(
                ActressSubscribeItem(
                    actress_id=actress.id,
                    name=actress.name,
                    image_url=actress.image_url,
                    ruby=actress.ruby,
                    subscribed_at=row.created_at,
                ),
            )

        return ActressSubscribeListResponse(
            items=items,
            total=total,
            limit=safe_limit,
            offset=safe_offset,
        )

    async def list_for_username(
        self,
        *,
        username: str,
        limit: int = 20,
        offset: int = 0,
    ) -> ActressSubscribeListResponse:
        """List actress subscriptions for a public username."""

        statement = select(User).where(User.username == username)
        user = (await self._session.exec(statement)).first()

        if user is None or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found.",
            )

        return await self.list_for_user(
            user_id=user.id,
            limit=limit,
            offset=offset,
        )
