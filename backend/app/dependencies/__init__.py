"""FastAPI dependency providers (composition root for DI)."""

from app.dependencies.database import SessionDep, get_session
from app.dependencies.redis import (
    AsyncRedisDep,
    CacheBackendDep,
    RateLimitBackendDep,
    cache,
    rate_limit,
)
from app.dependencies.repositories import (
    ActressRepositoryDep,
    GenreRepositoryDep,
    MakerRepositoryDep,
    SeriesRepositoryDep,
    VideoRepositoryDep,
    get_actress_repository,
    get_genre_repository,
    get_maker_repository,
    get_series_repository,
    get_video_repository,
)
from app.dependencies.services import (
    ActressServiceDep,
    GenreServiceDep,
    HealthServiceDep,
    MakerServiceDep,
    SeriesServiceDep,
    VideoServiceDep,
    get_actress_service,
    get_genre_service,
    get_health_service,
    get_maker_service,
    get_series_service,
    get_video_service,
)
from app.dependencies.settings import SettingsDep, get_settings
from app.dependencies.storage import ObjectStorageDep, get_storage

__all__ = [
    "ActressRepositoryDep",
    "ActressServiceDep",
    "GenreRepositoryDep",
    "GenreServiceDep",
    "MakerRepositoryDep",
    "MakerServiceDep",
    "SeriesRepositoryDep",
    "SeriesServiceDep",
    "HealthServiceDep",
    "SessionDep",
    "SettingsDep",
    "VideoRepositoryDep",
    "VideoServiceDep",
    "get_actress_repository",
    "get_actress_service",
    "get_genre_repository",
    "get_genre_service",
    "get_series_repository",
    "get_series_service",
    "get_maker_repository",
    "get_maker_service",
    "get_health_service",
    "get_session",
    "get_settings",
    "ObjectStorageDep",
    "get_storage",
    "get_video_repository",
    "get_video_service",
    "AsyncRedisDep",
    "CacheBackendDep",
    "RateLimitBackendDep",
    "cache",
    "rate_limit",
]
