"""Auth route package — registration, login, logout, and session endpoints."""

from fastapi import APIRouter

from app.routes.api.v1.auth.login import router as login_router
from app.routes.api.v1.auth.logout import router as logout_router
from app.routes.api.v1.auth.me import router as me_router
from app.routes.api.v1.auth.register import router as register_router

router = APIRouter(prefix="/auth")

router.include_router(register_router)
router.include_router(login_router)
router.include_router(logout_router)
router.include_router(me_router)

__all__ = ["router"]
