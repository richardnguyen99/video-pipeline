"""API v1 routers - FastAPI equivalent of Flask Blueprints.

Each module under this package exposes an APIRouter (like a Blueprint).
This package aggregates them under the /api/v1 prefix.
"""

from fastapi import APIRouter

from app.routes.api.v1.health import router as health_router

api_v1_router = APIRouter(prefix="/api/v1")

api_v1_router.include_router(
    health_router,
    tags=["health"],
)
