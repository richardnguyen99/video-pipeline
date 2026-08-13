"""Application configuration loaded from environment variables."""

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_VERSION_FILE = Path(__file__).resolve().parents[1] / "VERSION"


def load_app_version() -> str:
    """Read ``backend/VERSION`` (major.minor.patch)."""

    if _VERSION_FILE.is_file():
        return _VERSION_FILE.read_text(encoding="utf-8").strip()

    return "0.1.0"


class Settings(BaseSettings):
    """Application settings."""

    app_name: str = "video-pipeline"
    app_version: str = Field(default_factory=load_app_version)
    debug: bool = False

    # Default matches .env.example; overridden by DATABASE_URL in the environment.
    database_url: str = (
        "postgresql://user:password@localhost:5432/video_pipeline"
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


settings = Settings()
