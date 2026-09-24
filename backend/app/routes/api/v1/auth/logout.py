"""User logout endpoint."""

from fastapi import APIRouter, status
from fastapi.responses import JSONResponse

from app.utils.auth_cookies import clear_access_token_cookie

router = APIRouter()


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Sign out and clear the access-token cookie",
    response_class=JSONResponse,
)
async def logout() -> JSONResponse:
    """Clear the HttpOnly access-token cookie.

    Always succeeds so clients can wipe local session state even when the
    cookie was already missing or expired.
    """

    response = JSONResponse(
        content=None,
        status_code=status.HTTP_204_NO_CONTENT,
    )
    clear_access_token_cookie(response)

    return response
