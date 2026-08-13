"""FastAPI dependency providers (composition root for DI)."""

from app.dependencies.database import SessionDep, get_session
from app.dependencies.repositories import (
    ActressRepositoryDep,
    get_actress_repository,
)
from app.dependencies.services import (
    ActressServiceDep,
    HealthServiceDep,
    get_actress_service,
    get_health_service,
)
from app.dependencies.settings import SettingsDep, get_settings

__all__ = [
    "ActressRepositoryDep",
    "ActressServiceDep",
    "HealthServiceDep",
    "SessionDep",
    "SettingsDep",
    "get_actress_repository",
    "get_actress_service",
    "get_health_service",
    "get_session",
    "get_settings",
]
