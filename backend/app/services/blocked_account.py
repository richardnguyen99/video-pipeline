"""Blocked-account application service."""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import HTTPException, status
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.playlist import PlaylistShare
from app.models.user import User
from app.models.user_blocked_account import UserBlockedAccount
from app.schemas.blocked_account import (
    BlockedAccountItem,
    BlockedAccountListResponse,
    BlockUserRequest,
)


def _initials_for(user: User) -> str:
    """Derive up to two uppercase initials from display name or username."""

    source = (user.display_name or user.username or "?").strip()
    parts = [part for part in source.split() if part]

    if len(parts) >= 2:
        return (parts[0][0] + parts[1][0]).upper()

    if source:
        return source[:2].upper()

    return "?"


class BlockedAccountService:
    """List, create, and remove user-to-user blocks."""

    def __init__(self, session: AsyncSession) -> None:
        """Create a service bound to an async session."""

        self._session = session

    async def __resolve_target(
        self,
        payload: BlockUserRequest,
    ) -> User:
        """Resolve the target user or raise 404."""

        if payload.user_id is not None:
            statement = select(User).where(User.id == payload.user_id)
            result = await self._session.exec(statement)
            user = result.first()

            if user is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User not found.",
                )

            return user

        username = (payload.username or "").strip()
        statement = select(User).where(User.username == username)
        result = await self._session.exec(statement)
        user = result.first()

        if user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found.",
            )

        return user

    def __to_item(
        self,
        *,
        blocked_user: User,
        blocked_at: object,
    ) -> BlockedAccountItem:
        """Map a blocked user + timestamp to the list item schema."""

        at = (
            blocked_at
            if isinstance(blocked_at, datetime)
            else blocked_user.created_at
        )

        return BlockedAccountItem(
            id=blocked_user.id,
            username=blocked_user.username,
            display_name=blocked_user.display_name,
            initials=_initials_for(blocked_user),
            blocked_at=at,
        )

    async def list_blocked(
        self,
        *,
        blocker_id: uuid.UUID,
    ) -> BlockedAccountListResponse:
        """Return all accounts blocked by the caller."""

        rows = await UserBlockedAccount.list_by_blocker(
            self._session,
            blocker_id=blocker_id,
        )

        if not rows:
            return BlockedAccountListResponse(items=[], total=0)

        blocked_ids = [row.blocked_id for row in rows]
        statement = select(User).where(col(User.id).in_(blocked_ids))
        result = await self._session.exec(statement)
        users_by_id = {user.id: user for user in result.all()}

        items: list[BlockedAccountItem] = []

        for row in rows:
            blocked_user = users_by_id.get(row.blocked_id)

            if blocked_user is None:
                continue

            items.append(
                self.__to_item(
                    blocked_user=blocked_user,
                    blocked_at=row.created_at,
                ),
            )

        return BlockedAccountListResponse(items=items, total=len(items))

    async def block_user(
        self,
        *,
        blocker_id: uuid.UUID,
        payload: BlockUserRequest,
    ) -> BlockedAccountItem:
        """Block a user. Idempotent when the block already exists."""

        target = await self.__resolve_target(payload)

        if target.id == blocker_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot block yourself.",
            )

        existing = await UserBlockedAccount.get_by_blocker_and_blocked(
            self._session,
            blocker_id=blocker_id,
            blocked_id=target.id,
        )

        if existing is not None:
            return self.__to_item(
                blocked_user=target,
                blocked_at=existing.created_at,
            )

        row = UserBlockedAccount.create(
            blocker_id=blocker_id,
            blocked_id=target.id,
        )
        self._session.add(row)
        await self._session.commit()
        await self._session.refresh(row)
        await self._session.refresh(target)

        await PlaylistShare.revoke_for_owner_and_user(
            self._session,
            owner_id=blocker_id,
            shared_with_user_id=target.id,
        )

        return self.__to_item(
            blocked_user=target,
            blocked_at=row.created_at,
        )

    async def unblock_user(
        self,
        *,
        blocker_id: uuid.UUID,
        blocked_id: uuid.UUID,
    ) -> None:
        """Remove a block. Raises 404 when the relationship is missing."""

        existing = await UserBlockedAccount.get_by_blocker_and_blocked(
            self._session,
            blocker_id=blocker_id,
            blocked_id=blocked_id,
        )

        if existing is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Block not found.",
            )

        await self._session.delete(existing)
        await self._session.commit()
