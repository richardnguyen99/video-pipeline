"""Video pipeline command-line interface (``vp-cli``)."""

from pathlib import Path

__all__ = ["__version__"]

_VERSION_FILE = Path(__file__).resolve().parents[1] / "VERSION"


def _load_version() -> str:
    """Read ``backend/VERSION`` (same source as the API package)."""

    if _VERSION_FILE.is_file():
        return _VERSION_FILE.read_text(encoding="utf-8").strip()

    return "0.0.0"


__version__ = _load_version()
