"""Mock user payloads for unit tests."""

from __future__ import annotations

import datetime
import uuid
from typing import Any


def make_user_dict(
    *,
    user_id: uuid.UUID | None = None,
    username: str = "testuser",
    email: str = "test@example.com",
    display_name: str | None = "Test User",
    is_active: bool = True,
) -> dict[str, Any]:
    """Build a plain dict shaped like a User row."""

    now = datetime.datetime(2026, 1, 1, tzinfo=datetime.timezone.utc)

    return {
        "id": user_id or uuid.UUID("00000000-0000-4000-8000-000000000001"),
        "username": username,
        "email": email,
        "display_name": display_name,
        "is_active": is_active,
        "created_at": now,
        "updated_at": now,
    }
