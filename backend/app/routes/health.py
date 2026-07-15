"""Health check endpoint."""

from fastapi import APIRouter, status
from pydantic import BaseModel

router = APIRouter()


class HealthResponse(BaseModel):
    """Response schema for the health check endpoint."""

    status: str
    version: str


@router.get(
    "/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Health check",
)
async def health_check() -> HealthResponse:
    """Return the current health status of the service."""
    from app.config import settings

    return HealthResponse(status="ok", version=settings.app_version)
