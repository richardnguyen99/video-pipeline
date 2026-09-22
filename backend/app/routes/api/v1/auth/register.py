"""User registration endpoint."""

from fastapi import APIRouter, Depends, status
from redis_fastapi import rate_limit

from app.cache.policy import BURST_RATE, SUSTAIN_RATE
from app.dependencies import AuthServiceDep
from app.schemas.auth import RegisterRequest, UserResponse

router = APIRouter()


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
    responses={
        status.HTTP_400_BAD_REQUEST: {
            "description": "Invalid username, email, or password.",
        },
        status.HTTP_409_CONFLICT: {
            "description": "Username or email already exists.",
        },
    },
    dependencies=[
        Depends(
            rate_limit(
                BURST_RATE,
                scope="auth_register:burst",
            ),
        ),
        Depends(
            rate_limit(
                SUSTAIN_RATE,
                scope="auth_register:sustain",
            ),
        ),
    ],
)
async def register(
    body: RegisterRequest,
    service: AuthServiceDep,
) -> UserResponse:
    """Create a user account with a bcrypt-hashed password.

    Username and email must be unique. Password requires at least eight
    characters, one uppercase letter, one digit, and one special character.
    Email is validated for RFC 6531 (SMTPUTF8) compliance.
    """

    return await service.register(body)
