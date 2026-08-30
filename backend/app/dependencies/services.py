"""Service-layer dependency providers."""

from typing import Annotated

from fastapi import Depends

from app.dependencies.repositories import (
    ActressRepositoryDep,
    GenreRepositoryDep,
    SeriesRepositoryDep,
    VideoRepositoryDep,
)
from app.dependencies.settings import SettingsDep
from app.services.actress import ActressService
from app.services.genre import GenreService
from app.services.health import HealthService
from app.services.series import SeriesService
from app.services.video import VideoService


def get_health_service(settings: SettingsDep) -> HealthService:
    """Build a request-scoped ``HealthService``."""

    return HealthService(settings=settings)


def get_actress_service(
    repository: ActressRepositoryDep,
) -> ActressService:
    """Build a request-scoped ``ActressService``."""

    return ActressService(repository=repository)


def get_video_service(
    repository: VideoRepositoryDep,
) -> VideoService:
    """Build a ``VideoService`` for the current request."""

    return VideoService(repository=repository)


def get_genre_service(
    repository: GenreRepositoryDep,
) -> GenreService:
    """Build a request-scoped ``GenreService``."""

    return GenreService(repository=repository)


def get_series_service(
    repository: SeriesRepositoryDep,
) -> SeriesService:
    """Build a request-scoped ``SeriesService``."""

    return SeriesService(repository=repository)


HealthServiceDep = Annotated[HealthService, Depends(get_health_service)]
ActressServiceDep = Annotated[ActressService, Depends(get_actress_service)]
VideoServiceDep = Annotated[VideoService, Depends(get_video_service)]
GenreServiceDep = Annotated[GenreService, Depends(get_genre_service)]
SeriesServiceDep = Annotated[SeriesService, Depends(get_series_service)]
