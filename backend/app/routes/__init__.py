"""Routes package — aggregates all routers."""

from fastapi import APIRouter

from app.routes.health import router as health_router

router = APIRouter()

router.include_router(health_router, tags=["health"])
