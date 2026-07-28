"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings."""

    app_name: str = "video-pipeline"
    app_version: str = "0.1.0"
    debug: bool = False

    # Default matches .env.example; overridden by DATABASE_URL in
    # the environment.
    database_url: str = (
        "postgresql://user:password@localhost:5432/video_pipeline"
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


settings = Settings()
