"""Application configuration loaded from environment variables."""

from enum import StrEnum
from pathlib import Path
from typing import Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_VERSION_FILE = Path(__file__).resolve().parents[1] / "VERSION"


def load_app_version() -> str:
    """Read ``backend/VERSION`` (major.minor.patch)."""

    if _VERSION_FILE.is_file():
        return _VERSION_FILE.read_text(encoding="utf-8").strip()

    return "0.1.0"


class AppEnvironment(StrEnum):
    """Runtime environment."""

    DEVELOPMENT = "development"
    PRODUCTION = "production"
    TEST = "test"


class ObjectStorageProvider(StrEnum):
    """Object-storage backend.

    ``minio`` is intended for local development only. Production should use
    ``s3`` (AWS S3 or another S3-compatible service such as R2/GCS interop).
    """

    MINIO = "minio"
    S3 = "s3"


class Settings(BaseSettings):
    """Application settings."""

    app_name: str = "video-pipeline"
    app_version: str = Field(default_factory=load_app_version)
    app_env: AppEnvironment = AppEnvironment.DEVELOPMENT
    debug: bool = False

    # Default matches .env.example; overridden by DATABASE_URL in the environment.
    database_url: str = (
        "postgresql://user:password@localhost:5432/video_pipeline"
    )

    # Redis configuration
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_password: str = "something-secret"

    # Object storage (MinIO locally, S3/CDN in production).
    object_storage_provider: ObjectStorageProvider = (
        ObjectStorageProvider.MINIO
    )
    # Empty/None → default AWS endpoint (production). MinIO needs an explicit URL.
    object_storage_endpoint: Optional[str] = "http://localhost:9000"
    object_storage_access_key: str = "minioadmin"
    object_storage_secret_key: str = "minioadmin"
    object_storage_bucket: str = "video-samples"
    object_storage_region: str = "us-east-1"
    object_storage_use_ssl: bool = False
    # Public URL prefix returned to clients (CDN or virtual-host/path style).
    object_storage_public_base_url: str = "http://localhost:9000/video-samples"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    @field_validator("object_storage_endpoint", mode="before")
    @classmethod
    def empty_endpoint_to_none(cls, value: object) -> object:
        """Treat blank endpoint as unset (use provider default)."""

        if value is None:
            return None

        if isinstance(value, str) and value.strip() == "":
            return None

        return value

    @property
    def is_production(self) -> bool:
        """Return True when running in production."""

        return self.app_env == AppEnvironment.PRODUCTION

    @property
    def object_storage_path_style(self) -> bool:
        """Path-style addressing is required for local MinIO."""

        return self.object_storage_provider == ObjectStorageProvider.MINIO


settings = Settings()
