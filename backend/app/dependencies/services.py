"""Service-layer dependency providers."""

import logging
from typing import Annotated

from fastapi import Depends

from app.config import settings
from app.dependencies.repositories import (
    ActressRepositoryDep,
    DirectorRepositoryDep,
    GenreRepositoryDep,
    LabelRepositoryDep,
    MakerRepositoryDep,
    SeriesRepositoryDep,
    UserRepositoryDep,
    VideoRepositoryDep,
)
from app.dependencies.settings import SettingsDep
from app.search.actress_service import ActressSearchService
from app.search.client import get_elasticsearch
from app.search.service import VideoSearchService
from app.services.actress import ActressService
from app.services.auth import AuthService
from app.services.director import DirectorService
from app.services.genre import GenreService
from app.services.health import HealthService
from app.services.label import LabelService
from app.services.maker import MakerService
from app.services.series import SeriesService
from app.services.video import VideoService

_logger = logging.getLogger("uvicorn.error")


def get_health_service(settings: SettingsDep) -> HealthService:
    """Build a request-scoped ``HealthService``."""

    return HealthService(settings=settings)


def get_actress_service(
    repository: ActressRepositoryDep,
) -> ActressService:
    """Build a request-scoped ``ActressService``."""

    search_service = None

    if settings.elasticsearch_enabled:
        search_service = ActressSearchService(get_elasticsearch())
    else:
        _logger.debug(
            "ActressService: skipping Elasticsearch (elasticsearch_enabled=%r)",
            settings.elasticsearch_enabled,
        )

    return ActressService(
        repository=repository,
        search_service=search_service,
    )


def get_video_service(
    repository: VideoRepositoryDep,
) -> VideoService:
    """Build a ``VideoService`` for the current request."""

    search_service = None

    if settings.elasticsearch_enabled:
        search_service = VideoSearchService(get_elasticsearch())
    else:
        _logger.debug(
            "VideoService: skipping Elasticsearch (elasticsearch_enabled=%r)",
            settings.elasticsearch_enabled,
        )

    return VideoService(
        repository=repository,
        search_service=search_service,
    )


def get_genre_service(
    repository: GenreRepositoryDep,
) -> GenreService:
    """Build a request-scoped ``GenreService``."""

    return GenreService(repository=repository)


def get_maker_service(
    repository: MakerRepositoryDep,
) -> MakerService:
    """Build a request-scoped ``MakerService``."""

    return MakerService(repository=repository)


def get_label_service(
    repository: LabelRepositoryDep,
) -> LabelService:
    """Build a request-scoped ``LabelService``."""

    return LabelService(repository=repository)


def get_director_service(
    repository: DirectorRepositoryDep,
) -> DirectorService:
    """Build a request-scoped ``DirectorService``."""

    return DirectorService(repository=repository)


def get_series_service(
    repository: SeriesRepositoryDep,
) -> SeriesService:
    """Build a request-scoped ``SeriesService``."""

    return SeriesService(repository=repository)


def get_auth_service(
    repository: UserRepositoryDep,
) -> AuthService:
    """Build a request-scoped ``AuthService``."""

    return AuthService(repository=repository)


HealthServiceDep = Annotated[HealthService, Depends(get_health_service)]
ActressServiceDep = Annotated[ActressService, Depends(get_actress_service)]
VideoServiceDep = Annotated[VideoService, Depends(get_video_service)]
GenreServiceDep = Annotated[GenreService, Depends(get_genre_service)]
MakerServiceDep = Annotated[MakerService, Depends(get_maker_service)]
LabelServiceDep = Annotated[LabelService, Depends(get_label_service)]
DirectorServiceDep = Annotated[DirectorService, Depends(get_director_service)]
SeriesServiceDep = Annotated[SeriesService, Depends(get_series_service)]
AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]
