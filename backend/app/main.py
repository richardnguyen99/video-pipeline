"""FastAPI application entry point."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any, Union

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

import app.models  # pylint: disable=unused-import
from app.config import settings
from app.database import create_db_and_tables
from app.routes import api_v1_router


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    """Handle application startup and shutdown events."""

    await create_db_and_tables()
    yield


fastapi_app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    debug=settings.debug,
    lifespan=lifespan,
    default_response_class=JSONResponse,
    docs_url="/api/v1/docs",
    redoc_url="/api/v1/redoc",
    openapi_url="/api/v1/openapi.json",
)

fastapi_app.include_router(api_v1_router)


def _error_body(
    *,
    status_code: int,
    detail: Union[str, list[Any], dict[str, Any]],
) -> dict[str, Any]:
    return {
        "success": False,
        "error": {
            "status_code": status_code,
            "detail": detail,
        },
    }


@fastapi_app.exception_handler(StarletteHTTPException)
async def http_exception_handler(
    _request: Request,
    exc: StarletteHTTPException,
) -> JSONResponse:
    """Return HTTP errors as JSON."""

    return JSONResponse(
        status_code=exc.status_code,
        content=_error_body(status_code=exc.status_code, detail=exc.detail),
    )


@fastapi_app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    _request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    """Return validation errors as JSON."""

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=_error_body(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=list(exc.errors()),
        ),
    )


@fastapi_app.exception_handler(Exception)
async def unhandled_exception_handler(
    _request: Request,
    exc: Exception,
) -> JSONResponse:
    """Return unexpected errors as JSON."""

    detail: str = str(exc) if settings.debug else "Internal server error"

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=_error_body(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail,
        ),
    )


@fastapi_app.api_route(
    "/{full_path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
    include_in_schema=False,
)
async def reject_non_api_routes(full_path: str) -> JSONResponse:
    """Reject any path outside ``/api/v1`` with a JSON 404."""

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Not Found",
    )
