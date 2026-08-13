"""Base repository with a shared async session."""

from sqlmodel.ext.asyncio.session import AsyncSession


class BaseRepository:
    """Hold an ``AsyncSession`` for concrete repositories."""

    def __init__(self, session: AsyncSession) -> None:
        """Bind this repository to a request-scoped session.

        Args:
            session: Active SQLModel async session.
        """

        self._session = session

    @property
    def session(self) -> AsyncSession:
        """Return the bound session."""

        return self._session
