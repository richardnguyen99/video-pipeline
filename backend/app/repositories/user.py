"""User and credential data-access."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional, Union

from sqlalchemy.exc import IntegrityError
from sqlmodel import col, select

from app.models.credentials import UserCredential
from app.models.user import User
from app.models.user_bio import UserBio
from app.repositories.base import BaseRepository

_MAX_FAILED_LOGINS = 5
_LOCKOUT_MINUTES = 15


class UserRepository(BaseRepository):
    """Persist and look up users and credentials."""

    async def get_by_id(self, user_id: uuid.UUID) -> Optional[User]:
        """Return a user by primary key, if any.

        Args:
            user_id: User UUID.

        Returns:
            Matching ``User`` or ``None``.
        """

        statement = select(User).where(col(User.id) == user_id)
        result = await self.session.exec(statement)

        return result.first()

    async def get_by_username(self, username: str) -> Optional[User]:
        """Return a user by exact username, if any.

        Args:
            username: Unique login handle.

        Returns:
            Matching ``User`` or ``None``.
        """

        statement = select(User).where(col(User.username) == username)
        result = await self.session.exec(statement)

        return result.first()

    async def get_by_email(self, email: str) -> Optional[User]:
        """Return a user by exact email, if any.

        Args:
            email: Unique contact address.

        Returns:
            Matching ``User`` or ``None``.
        """

        statement = select(User).where(col(User.email) == email)
        result = await self.session.exec(statement)

        return result.first()

    async def search_by_username_or_email(
        self,
        query: str,
        *,
        limit: int = 10,
        exclude_user_id: Optional[uuid.UUID] = None,
    ) -> list[tuple[User, Optional[str]]]:
        """Return active users whose username or email matches ``query``.

        Each row is ``(user, preferred_display_name)`` where the preferred
        name is ``UserBio.full_name`` when set, otherwise
        ``User.display_name``.

        Args:
            query: Case-insensitive substring to match.
            limit: Maximum rows to return.
            exclude_user_id: Optional user to omit (e.g. the caller).

        Returns:
            Matching active users ordered by username, with preferred
            display names.
        """

        pattern = f"%{query.strip()}%"
        statement = (
            select(User, UserBio.full_name)
            .outerjoin(UserBio, col(UserBio.user_id) == col(User.id))
            .where(
                col(User.is_active).is_(True),
                (
                    col(User.username).ilike(pattern)
                    | col(User.email).ilike(pattern)
                ),
            )
            .order_by(col(User.username).asc())
            .limit(max(1, min(limit, 50)))
        )

        if exclude_user_id is not None:
            statement = statement.where(col(User.id) != exclude_user_id)

        result = await self.session.exec(statement)
        rows = list(result.all())

        return [
            (user, full_name if full_name else user.display_name)
            for user, full_name in rows
        ]

    async def create_with_credential(
        self,
        *,
        username: str,
        email: str,
        password_hash: str,
        password_algorithm: str,
        display_name: Optional[str] = None,
    ) -> User:
        """Insert a user and credential in one transaction.

        Args:
            username: Unique login handle.
            email: Unique contact address.
            password_hash: Pre-hashed password (bcrypt).
            password_algorithm: Algorithm label stored on the credential.
            display_name: Optional human-friendly name.

        Returns:
            The persisted ``User`` (with credential linked in session).

        Raises:
            IntegrityError: When username or email already exists.
        """

        user = User.create(
            username=username,
            email=email,
            display_name=display_name,
            email_verified=False,
        )
        self.session.add(user)
        await self.session.flush()

        credential = UserCredential.create(
            user_id=user.id,
            password_hash=password_hash,
            password_algorithm=password_algorithm,
        )
        self.session.add(credential)

        try:
            await self.session.commit()
        except IntegrityError:
            await self.session.rollback()
            raise

        await self.session.refresh(user)

        return user

    async def update_with_credential(
        self,
        user: User,
        *,
        username: str,
        email: str,
        password_hash: str,
        password_algorithm: str,
        display_name: Optional[str] = None,
    ) -> User:
        """Overwrite profile and password hash for an existing user.

        Args:
            user: Existing user row to update.
            username: New unique login handle.
            email: New unique contact address.
            password_hash: Pre-hashed password (bcrypt).
            password_algorithm: Algorithm label stored on the credential.
            display_name: Optional human-friendly name.

        Returns:
            The refreshed ``User`` after commit.

        Raises:
            IntegrityError: When the new username or email collides
                with a different user.
        """

        user.username = username
        user.email = email
        user.display_name = display_name
        self.session.add(user)

        credential = await UserCredential.get_by_user_id(
            self.session,
            user.id,
        )

        if credential is None:
            credential = UserCredential.create(
                user_id=user.id,
                password_hash=password_hash,
                password_algorithm=password_algorithm,
            )
        else:
            credential.password_hash = password_hash
            credential.password_algorithm = password_algorithm

        self.session.add(credential)

        try:
            await self.session.commit()
        except IntegrityError:
            await self.session.rollback()
            raise

        await self.session.refresh(user)

        return user

    async def mark_email_verified(self, user_id: uuid.UUID) -> Optional[User]:
        """Set ``email_verified`` for ``user_id`` and return the user.

        Args:
            user_id: Account whose email was confirmed.

        Returns:
            The refreshed user, or ``None`` when the id is unknown.
        """

        user = await self.get_by_id(user_id)

        if user is None:
            return None

        user.email_verified = True
        user.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)

        return user

    async def update_password(
        self,
        user_id: uuid.UUID,
        *,
        password_hash: str,
        password_algorithm: str,
    ) -> None:
        """Replace the stored password hash for ``user_id``.

        Args:
            user_id: Account whose credential row is updated.
            password_hash: New bcrypt hash.
            password_algorithm: Algorithm label stored on the credential.

        Raises:
            LookupError: When no credential row exists for the user.
        """

        credential = await UserCredential.get_by_user_id(
            self.session,
            user_id,
        )

        if credential is None:
            raise LookupError(f"No credential for user {user_id}")

        credential.password_hash = password_hash
        credential.password_algorithm = password_algorithm
        credential.password_changed_at = datetime.now(timezone.utc).replace(
            tzinfo=None,
        )
        credential.failed_login_attempts = 0
        credential.locked_until = None
        self.session.add(credential)
        await self.session.commit()

    async def record_login_success(self, user: User) -> User:
        """Reset failed-login counters and stamp ``last_login_at``.

        Args:
            user: Authenticated user.

        Returns:
            The refreshed user after commit.
        """

        credential = await UserCredential.get_by_user_id(
            self.session,
            user.id,
        )

        if credential is not None:
            credential.failed_login_attempts = 0
            credential.locked_until = None
            credential.last_login_at = datetime.now(timezone.utc).replace(
                tzinfo=None,
            )
            self.session.add(credential)

        await self.session.commit()
        await self.session.refresh(user)

        return user

    async def record_login_failure(self, user: User) -> None:
        """Increment failed-login attempts and lock after the threshold.

        Args:
            user: User whose credentials failed verification.
        """

        credential = await UserCredential.get_by_user_id(
            self.session,
            user.id,
        )

        if credential is None:
            return

        credential.failed_login_attempts = credential.failed_login_attempts + 1

        if credential.failed_login_attempts >= _MAX_FAILED_LOGINS:
            credential.locked_until = (
                datetime.now(timezone.utc)
                + timedelta(minutes=_LOCKOUT_MINUTES)
            ).replace(tzinfo=None)
            credential.failed_login_attempts = 0

        self.session.add(credential)
        await self.session.commit()

    async def get_bio_by_user_id(
        self, user_id: uuid.UUID
    ) -> Optional[UserBio]:
        """Return the biography row for ``user_id``, if any.

        Args:
            user_id: Owning user's UUID.

        Returns:
            Matching ``UserBio`` or ``None``.
        """

        return await UserBio.get_by_user_id(self.session, user_id)

    async def upsert_bio(
        self,
        user_id: uuid.UUID,
        *,
        full_name: Optional[str] = None,
        date_of_birth: Optional[Union[date, datetime]] = None,
        country: Optional[str] = None,
        gender: Optional[str] = None,
        biography: Optional[str] = None,
        link: Optional[str] = None,
        fields_set: Optional[set[str]] = None,
    ) -> UserBio:
        """Create or update the biography for ``user_id``.

        When ``fields_set`` is provided, only those attribute names are
        written (partial update). When omitted, every argument is applied.

        Args:
            user_id: Owning user's UUID.
            full_name: Legal or preferred full name.
            date_of_birth: Date of birth (date or datetime).
            country: Country or region label.
            gender: Gender label.
            biography: Free-text biography.
            link: Single associated URL.
            fields_set: Optional set of field names present in the request.

        Returns:
            The persisted ``UserBio`` row.
        """

        bio = await UserBio.get_by_user_id(self.session, user_id)
        apply_all = fields_set is None

        if bio is None:
            bio = UserBio.create(user_id=user_id)
            apply_all = True

        if apply_all or "full_name" in (fields_set or set()):
            bio.full_name = full_name

        if apply_all or "date_of_birth" in (fields_set or set()):
            if date_of_birth is None:
                bio.date_of_birth = None
            elif isinstance(date_of_birth, datetime):
                bio.date_of_birth = date_of_birth.date()
            else:
                bio.date_of_birth = date_of_birth

        if apply_all or "country" in (fields_set or set()):
            bio.country = country

        if apply_all or "gender" in (fields_set or set()):
            bio.gender = gender

        if apply_all or "biography" in (fields_set or set()):
            bio.biography = biography

        if apply_all or "link" in (fields_set or set()):
            bio.link = link

        bio.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)

        self.session.add(bio)
        await self.session.commit()
        await self.session.refresh(bio)

        return bio
