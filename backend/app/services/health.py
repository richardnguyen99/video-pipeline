"""Health-check application service."""

from app.config import Settings
from app.schemas.health import HealthResponse


class HealthService:
    """Expose process health without touching persistence."""

    def __init__(self, settings: Settings) -> None:
        """Create a health service.

        Args:
            settings: Application settings used for version reporting.
        """

        self._settings = settings

    def get_health(self) -> HealthResponse:
        """Return the current health payload.

        Returns:
            A ``HealthResponse`` with status ``ok`` and the configured
            application version.
        """

        return HealthResponse(
            status="ok",
            version=self._settings.app_version,
        )
