"""Repository dependency providers."""

from typing import Annotated

from fastapi import Depends

from app.dependencies.database import SessionDep
from app.repositories.actress import ActressRepository
from app.repositories.director import DirectorRepository
from app.repositories.genre import GenreRepository
from app.repositories.label import LabelRepository
from app.repositories.maker import MakerRepository
from app.repositories.series import SeriesRepository
from app.repositories.user import UserRepository
from app.repositories.video import VideoRepository


def get_user_repository(session: SessionDep) -> UserRepository:
    """Build a request-scoped ``UserRepository``."""

    return UserRepository(session=session)


def get_actress_repository(session: SessionDep) -> ActressRepository:
    """Build a request-scoped ``ActressRepository``."""

    return ActressRepository(session=session)


def get_video_repository(session: SessionDep) -> VideoRepository:
    """Build a request-scoped ``VideoRepository``."""

    return VideoRepository(session=session)


def get_genre_repository(session: SessionDep) -> GenreRepository:
    """Build a request-scoped ``GenreRepository``."""

    return GenreRepository(session=session)


def get_series_repository(session: SessionDep) -> SeriesRepository:
    """Build a request-scoped ``SeriesRepository``."""

    return SeriesRepository(session=session)


def get_maker_repository(session: SessionDep) -> MakerRepository:
    """Build a request-scoped ``MakerRepository``."""

    return MakerRepository(session=session)


def get_label_repository(session: SessionDep) -> LabelRepository:
    """Build a request-scoped ``LabelRepository``."""

    return LabelRepository(session=session)


def get_director_repository(session: SessionDep) -> DirectorRepository:
    """Build a request-scoped ``DirectorRepository``."""

    return DirectorRepository(session=session)


ActressRepositoryDep = Annotated[
    ActressRepository,
    Depends(get_actress_repository),
]
VideoRepositoryDep = Annotated[
    VideoRepository,
    Depends(get_video_repository),
]
GenreRepositoryDep = Annotated[
    GenreRepository,
    Depends(get_genre_repository),
]
SeriesRepositoryDep = Annotated[
    SeriesRepository,
    Depends(get_series_repository),
]
MakerRepositoryDep = Annotated[
    MakerRepository,
    Depends(get_maker_repository),
]
LabelRepositoryDep = Annotated[
    LabelRepository,
    Depends(get_label_repository),
]
DirectorRepositoryDep = Annotated[
    DirectorRepository,
    Depends(get_director_repository),
]
UserRepositoryDep = Annotated[
    UserRepository,
    Depends(get_user_repository),
]
