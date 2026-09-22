"""Auth route package — registration and future login endpoints."""

from fastapi import APIRouter

from app.routes.api.v1.auth.register import router as register_router

router = APIRouter(prefix="/auth")

router.include_router(register_router)

__all__ = ["router"]
