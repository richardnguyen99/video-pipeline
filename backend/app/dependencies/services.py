"""Service-layer dependency providers."""

from typing import Annotated

from fastapi import Depends

from app.dependencies.repositories import ActressRepositoryDep
from app.dependencies.settings import SettingsDep
from app.services.actress import ActressService
from app.services.health import HealthService


def get_health_service(settings: SettingsDep) -> HealthService:
    """Build a request-scoped ``HealthService``."""

    return HealthService(settings=settings)


def get_actress_service(
    repository: ActressRepositoryDep,
) -> ActressService:
    """Build a request-scoped ``ActressService``."""

    return ActressService(repository=repository)


HealthServiceDep = Annotated[HealthService, Depends(get_health_service)]
ActressServiceDep = Annotated[ActressService, Depends(get_actress_service)]
