"""Repository dependency providers."""

from typing import Annotated

from fastapi import Depends

from app.dependencies.database import SessionDep
from app.repositories.actress import ActressRepository


def get_actress_repository(session: SessionDep) -> ActressRepository:
    """Build a request-scoped ``ActressRepository``."""

    return ActressRepository(session=session)


ActressRepositoryDep = Annotated[
    ActressRepository,
    Depends(get_actress_repository),
]
