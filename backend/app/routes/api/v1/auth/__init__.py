"""Auth route package — registration, login, logout, and session endpoints."""

from fastapi import APIRouter

from app.routes.api.v1.auth.bio import router as bio_router
from app.routes.api.v1.auth.change_password import (
    router as change_password_router,
)
from app.routes.api.v1.auth.forgot_password import (
    router as forgot_password_router,
)
from app.routes.api.v1.auth.login import router as login_router
from app.routes.api.v1.auth.logout import router as logout_router
from app.routes.api.v1.auth.me import router as me_router
from app.routes.api.v1.auth.refresh import router as refresh_router
from app.routes.api.v1.auth.register import router as register_router
from app.routes.api.v1.auth.verify import router as verify_router

router = APIRouter(prefix="/auth")

router.include_router(register_router)
router.include_router(login_router)
router.include_router(logout_router)
router.include_router(refresh_router)
router.include_router(me_router)
router.include_router(bio_router)
router.include_router(change_password_router)
router.include_router(verify_router)
router.include_router(forgot_password_router)

__all__ = ["router"]
