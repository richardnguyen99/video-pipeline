"""API v1 routers - FastAPI equivalent of Flask Blueprints.

Each module under this package exposes an APIRouter (like a Blueprint).
This package aggregates them under the /api/v1 prefix.
"""

from fastapi import APIRouter

from app.routes.api.v1.actresses import router as actresses_router
from app.routes.api.v1.auth import router as auth_router
from app.routes.api.v1.directors import router as directors_router
from app.routes.api.v1.genres import router as genres_router
from app.routes.api.v1.health import router as health_router
from app.routes.api.v1.labels import router as labels_router
from app.routes.api.v1.makers import router as makers_router
from app.routes.api.v1.search_ui import router as search_ui_router
from app.routes.api.v1.series import router as series_router
from app.routes.api.v1.videos import router as videos_router

api_v1_router = APIRouter(prefix="/api/v1")

api_v1_router.include_router(
    health_router,
    tags=["health"],
)
api_v1_router.include_router(
    auth_router,
    tags=["auth"],
)
api_v1_router.include_router(
    actresses_router,
    tags=["actresses"],
)
api_v1_router.include_router(
    videos_router,
    tags=["videos"],
)
api_v1_router.include_router(
    search_ui_router,
    tags=["search-ui"],
)
api_v1_router.include_router(
    genres_router,
    tags=["genres"],
)
api_v1_router.include_router(
    series_router,
    tags=["series"],
)
api_v1_router.include_router(
    makers_router,
    tags=["makers"],
)
api_v1_router.include_router(
    labels_router,
    tags=["labels"],
)
api_v1_router.include_router(
    directors_router,
    tags=["directors"],
)
