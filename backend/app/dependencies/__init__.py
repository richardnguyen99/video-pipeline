"""FastAPI dependency providers (composition root for DI)."""

from app.dependencies.database import SessionDep, get_session
from app.dependencies.services import HealthServiceDep, get_health_service
from app.dependencies.settings import SettingsDep, get_settings

__all__ = [
    "HealthServiceDep",
    "SessionDep",
    "SettingsDep",
    "get_health_service",
    "get_session",
    "get_settings",
]
