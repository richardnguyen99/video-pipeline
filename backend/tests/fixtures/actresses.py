"""Mock actress payloads for unit tests."""

from __future__ import annotations

from typing import Any


def make_actress_dict(
    *,
    actress_id: int = 1,
    name: str = "Test Actress",
    dmm_id: str | None = "dmm-1",
    ruby: str | None = "てすと",
    image_url: str | None = "https://example.com/a.jpg",
) -> dict[str, Any]:
    """Build a plain dict shaped like an Actress row."""

    return {
        "id": actress_id,
        "name": name,
        "dmm_id": dmm_id,
        "ruby": ruby,
        "image_url": image_url,
    }
