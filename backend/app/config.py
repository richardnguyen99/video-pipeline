"""Application configuration loaded from environment variables."""

from enum import StrEnum
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_ROOT = Path(__file__).resolve().parents[1]
_VERSION_FILE = _BACKEND_ROOT / "VERSION"
_ENV_FILE = _BACKEND_ROOT / ".env"

if _ENV_FILE.is_file():
    load_dotenv(_ENV_FILE, override=True)


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

    # Comma-separated browser origins allowed to call the API (CORS).
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    # Public SPA origin used in email verification links.
    frontend_base_url: str = "http://localhost:3000"
    # Email verification link lifetime (minutes).
    email_verification_expire_minutes: int = 15
    # Minimum wait before another verification email may be sent (minutes).
    email_verification_resend_cooldown_minutes: int = 5

    # JWT tokens (HttpOnly cookies). Durations use explicit unit suffixes.
    jwt_secret_key: str = "change-me-in-production-use-a-long-random-string"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 15
    jwt_refresh_token_expire_minutes: int = 20160
    jwt_refresh_rotation_grace_seconds: int = 30
    jwt_cookie_name: str = "access_token"
    jwt_refresh_cookie_name: str = "refresh_token"
    jwt_cookie_path: str = "/"
    # Refresh cookie is only sent under /api/v1/auth/ (refresh + logout).
    # Access tokens live in memory on the client.
    jwt_refresh_cookie_path: str = "/api/v1/auth/"
    jwt_cookie_samesite: str = "lax"

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

    # Elasticsearch (optional; when disabled, video ``q`` uses Postgres).
    elasticsearch_enabled: bool = Field(
        default=False,
        description="When true, video list ``q`` uses the Elasticsearch index.",
    )
    elasticsearch_url: str = "http://localhost:9200"
    elasticsearch_index_videos: str = "videos"
    elasticsearch_index_actresses: str = "actresses"
    elasticsearch_username: Optional[str] = None
    elasticsearch_password: Optional[str] = None

    # Resend email (all secrets use the RESEND_ env prefix).
    resend_api_key: Optional[str] = Field(
        default=None,
        description="Resend API key (env: RESEND_API_KEY).",
    )
    resend_from_email: Optional[str] = Field(
        default=None,
        description=(
            "Default From header, e.g. 'Velvet <noreply@example.com>' "
            "(env: RESEND_FROM_EMAIL)."
        ),
    )
    resend_webhook_secret: Optional[str] = Field(
        default=None,
        description="Svix signing secret for Resend webhooks "
        "(env: RESEND_WEBHOOK_SECRET).",
    )
    resend_audience_id: Optional[str] = Field(
        default=None,
        description="Optional Resend audience id for contacts "
        "(env: RESEND_AUDIENCE_ID).",
    )

    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE) if _ENV_FILE.is_file() else None,
        env_file_encoding="utf-8",
        env_ignore_empty=True,
        case_sensitive=False,
        extra="ignore",
    )

    @field_validator("elasticsearch_enabled", mode="before")
    @classmethod
    def parse_elasticsearch_enabled(cls, value: object) -> object:
        """Accept common truthy/falsey string forms from env files."""

        if isinstance(value, str):
            normalized = value.strip().lower()

            if normalized in {"1", "true", "yes", "on"}:
                return True

            if normalized in {"0", "false", "no", "off", ""}:
                return False

        return value

    @property
    def cors_origin_list(self) -> list[str]:
        """Parse ``cors_origins`` into a list of origin URLs."""

        return [
            origin.strip()
            for origin in self.cors_origins.split(",")
            if origin.strip()
        ]

    @property
    def jwt_cookie_secure(self) -> bool:
        """Default ``Secure`` flag for the JWT cookie outside of helpers.

        Production enables Secure. Development and test keep it off so
        cookies work on ``http://localhost``. Cookie helpers may still
        force Secure when ``SameSite=None`` in production.
        """

        return self.app_env == AppEnvironment.PRODUCTION

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
