"""Health check endpoint."""

from fastapi import APIRouter, status

from app.dependencies import HealthServiceDep
from app.schemas.health import HealthResponse

router = APIRouter()


@router.get(
    "/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Health check",
)
async def health_check(service: HealthServiceDep) -> HealthResponse:
    """Return the current health status of the service."""

    return service.get_health()
