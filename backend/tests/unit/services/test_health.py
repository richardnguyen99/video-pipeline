"""Unit tests for ``app.services.health.HealthService``."""

from __future__ import annotations

from app.config import Settings
from app.services.health import HealthService


def test_get_health_returns_ok_status(settings: Settings) -> None:
    """``get_health`` reports status ``ok``."""

    service = HealthService(settings=settings)

    result = service.get_health()

    assert result.status == "ok"


def test_get_health_returns_configured_version(settings: Settings) -> None:
    """``get_health`` echoes the settings application version."""

    custom = Settings(
        app_name="video-pipeline-test",
        app_version="9.9.9-test",
        debug=True,
        database_url="postgresql://test:test@localhost:5432/test",
    )
    service = HealthService(settings=custom)

    result = service.get_health()

    assert result.version == "9.9.9-test"


def test_get_health_uses_fixture_settings_version(settings: Settings) -> None:
    """``get_health`` uses the injected settings fixture version."""

    service = HealthService(settings=settings)

    result = service.get_health()

    assert result.version == settings.app_version
