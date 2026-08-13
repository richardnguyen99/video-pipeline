"""Health-check response schemas."""

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Public health payload returned by ``GET /api/v1/health``."""

    status: str = Field(description="Service liveness indicator.")
    version: str = Field(description="Application version string.")
