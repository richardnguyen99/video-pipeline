"""Canonical display-name resolution for users.

The only human-facing name source is ``UserBio.full_name``. When that is
unset, callers should fall back to ``User.username``. The legacy
``User.display_name`` column has been removed to avoid dual sources.
"""

from __future__ import annotations

from typing import Optional


def preferred_display_name(
    *,
    username: str,
    full_name: Optional[str] = None,
) -> str:
    """Return the name that should be shown in UI for a user.

    Args:
        username: Account handle (always available).
        full_name: Optional biography full name.

    Returns:
        Trimmed full name when present, otherwise ``username``.
    """

    if full_name is not None:
        trimmed = full_name.strip()

        if trimmed:
            return trimmed

    return username
