"""Service-layer dependency providers."""

from typing import Annotated

from fastapi import Depends

from app.dependencies.settings import SettingsDep
from app.services.health import HealthService


def get_health_service(settings: SettingsDep) -> HealthService:
    """Build a request-scoped ``HealthService``."""

    return HealthService(settings=settings)


HealthServiceDep = Annotated[HealthService, Depends(get_health_service)]
