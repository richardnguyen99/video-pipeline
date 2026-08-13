"""Repository dependency providers."""

from typing import Annotated

from fastapi import Depends

from app.dependencies.database import SessionDep
from app.repositories.actress import ActressRepository
from app.repositories.video import VideoRepository


def get_actress_repository(session: SessionDep) -> ActressRepository:
    """Build a request-scoped ``ActressRepository``."""

    return ActressRepository(session=session)


def get_video_repository(session: SessionDep) -> VideoRepository:
    """Build a request-scoped ``VideoRepository``."""

    return VideoRepository(session=session)


ActressRepositoryDep = Annotated[
    ActressRepository,
    Depends(get_actress_repository),
]
VideoRepositoryDep = Annotated[
    VideoRepository,
    Depends(get_video_repository),
]
