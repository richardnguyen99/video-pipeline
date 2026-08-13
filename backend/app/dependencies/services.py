"""Service-layer dependency providers."""

from typing import Annotated

from fastapi import Depends

from app.dependencies.repositories import (
    ActressRepositoryDep,
    VideoRepositoryDep,
)
from app.dependencies.settings import SettingsDep
from app.services.actress import ActressService
from app.services.health import HealthService
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
    """Build a request-scoped ``VideoService``."""

    return VideoService(repository=repository)


HealthServiceDep = Annotated[HealthService, Depends(get_health_service)]
ActressServiceDep = Annotated[ActressService, Depends(get_actress_service)]
VideoServiceDep = Annotated[VideoService, Depends(get_video_service)]
