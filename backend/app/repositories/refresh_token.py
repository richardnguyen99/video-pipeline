"""Refresh-token allowlist data-access."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import update
from sqlmodel import col, select

from app.models.refresh_token import RefreshToken
from app.repositories.base import BaseRepository


def _as_utc(value: datetime) -> datetime:
    """Normalize a DB timestamp to timezone-aware UTC."""

    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)

    return value.astimezone(timezone.utc)


def _as_naive_utc(value: datetime) -> datetime:
    """Strip tzinfo for TIMESTAMP WITHOUT TIME ZONE columns.

    Values are assumed to be UTC (or converted to UTC first).
    """

    if value.tzinfo is not None:
        value = value.astimezone(timezone.utc)

    return value.replace(tzinfo=None)


class RefreshTokenRepository(BaseRepository):
    """Persist and look up refresh-token allowlist rows."""

    async def get_by_token_hash(
        self,
        token_hash: str,
        *,
        for_update: bool = False,
    ) -> Optional[RefreshToken]:
        """Return the allowlist row for ``token_hash``, if any.

        Args:
            token_hash: SHA-256 of the raw refresh JWT.
            for_update: When true, lock the row for the rest of the
                transaction (rotation / concurrent refresh).

        Returns:
            Matching ``RefreshToken`` or ``None``.
        """

        statement = select(RefreshToken).where(
            col(RefreshToken.token_hash) == token_hash,
        )

        if for_update:
            statement = statement.with_for_update()

        result = await self.session.exec(statement)

        return result.first()

    async def issue(
        self,
        *,
        user_id: uuid.UUID,
        token_hash: str,
        expires_at: datetime,
        user_agent: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> RefreshToken:
        """Insert a new active allowlist entry (login or rotation).

        Args:
            user_id: Owning user.
            token_hash: SHA-256 of the raw refresh JWT.
            expires_at: UTC expiry for this token.
            user_agent: Optional client user-agent at issuance.
            ip_address: Optional client IP at issuance.

        Returns:
            The persisted ``RefreshToken`` row.
        """

        row = RefreshToken.create(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=_as_naive_utc(expires_at),
            user_agent=user_agent,
            ip_address=ip_address,
        )
        self.session.add(row)
        await self.session.commit()
        await self.session.refresh(row)

        return row

    async def revoke(
        self,
        row: RefreshToken,
        *,
        replaced_by_id: Optional[uuid.UUID] = None,
        revoked_at: Optional[datetime] = None,
    ) -> RefreshToken:
        """Mark an allowlist entry revoked (logout or rotation).

        Args:
            row: Existing allowlist row.
            replaced_by_id: Successor token id when rotating.
            revoked_at: Revocation timestamp (defaults to now UTC).

        Returns:
            The updated row.
        """

        if row.revoked_at is not None:
            return row

        when = _as_naive_utc(revoked_at or datetime.now(timezone.utc))
        row.revoked_at = when

        if replaced_by_id is not None:
            row.replaced_by_id = replaced_by_id

        self.session.add(row)
        await self.session.commit()
        await self.session.refresh(row)

        return row

    async def revoke_by_token_hash(
        self,
        token_hash: str,
    ) -> Optional[RefreshToken]:
        """Revoke the allowlist entry for ``token_hash`` if present.

        Args:
            token_hash: SHA-256 of the raw refresh JWT.

        Returns:
            The revoked row, or ``None`` when no matching entry exists.
        """

        row = await self.get_by_token_hash(token_hash)

        if row is None:
            return None

        return await self.revoke(row)

    def is_usable(self, row: RefreshToken) -> bool:
        """Return whether ``row`` is still valid for a refresh request.

        Allowlist rules: present, not revoked, and not past ``expires_at``.
        """

        if row.revoked_at is not None:
            return False

        expires = _as_utc(row.expires_at)
        now = datetime.now(timezone.utc)

        return expires > now

    async def rotate(
        self,
        *,
        current: RefreshToken,
        new_token_hash: str,
        new_expires_at: datetime,
        user_agent: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> RefreshToken:
        """Revoke ``current`` and insert its replacement in one step.

        Args:
            current: Locked allowlist row being rotated out.
            new_token_hash: Hash of the newly issued refresh JWT.
            new_expires_at: Expiry for the new token.
            user_agent: Optional client user-agent.
            ip_address: Optional client IP.

        Returns:
            The newly issued allowlist row.
        """

        when = _as_naive_utc(datetime.now(timezone.utc))
        replacement = RefreshToken.create(
            user_id=current.user_id,
            token_hash=new_token_hash,
            expires_at=_as_naive_utc(new_expires_at),
            user_agent=user_agent,
            ip_address=ip_address,
        )
        self.session.add(replacement)
        await self.session.flush()

        current.revoked_at = when
        current.replaced_by_id = replacement.id
        self.session.add(current)
        await self.session.commit()
        await self.session.refresh(replacement)

        return replacement

    async def revoke_all_for_user(self, user_id: uuid.UUID) -> int:
        """Revoke every active allowlist entry for ``user_id``.

        Args:
            user_id: Account whose sessions should end.

        Returns:
            Number of rows updated.
        """

        now = _as_naive_utc(datetime.now(timezone.utc))
        statement = (
            update(RefreshToken)
            .where(
                col(RefreshToken.user_id) == user_id,
                col(RefreshToken.revoked_at).is_(None),
            )
            .values(revoked_at=now)
        )
        result = await self.session.exec(statement)
        await self.session.commit()

        return len(result.scalars().all())
