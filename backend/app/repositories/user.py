"""User and credential data-access."""

from __future__ import annotations

from typing import Optional

from sqlalchemy.exc import IntegrityError
from sqlmodel import col, select

from app.models.credentials import UserCredential
from app.models.user import User
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository):
    """Persist and look up users and credentials."""

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
