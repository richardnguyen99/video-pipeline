"""Routes package — aggregates versioned API routers."""

from app.routes.api.v1 import api_v1_router

__all__ = ["api_v1_router"]
