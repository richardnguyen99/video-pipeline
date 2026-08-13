"""Settings dependency."""

from typing import Annotated

from fastapi import Depends

from app.config import Settings, settings


def get_settings() -> Settings:
    """Provide the process-wide settings instance."""

    return settings


SettingsDep = Annotated[Settings, Depends(get_settings)]
