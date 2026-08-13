"""Database session dependency."""

from typing import Annotated

from fastapi import Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from app.database import get_session as _get_session

get_session = _get_session

SessionDep = Annotated[AsyncSession, Depends(get_session)]
