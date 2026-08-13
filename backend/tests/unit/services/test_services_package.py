"""Smoke tests for the services package.

When a new module is added under ``app.services`` (other than
``__init__.py``), add a matching ``test_<module>.py`` here. Cover each
return path of every public function in its own test case.
"""

from __future__ import annotations

import importlib
from pathlib import Path


def test_services_package_importable() -> None:
    """Services package must import without side effects."""

    module = importlib.import_module("app.services")

    assert module is not None


def test_service_modules_have_matching_test_files() -> None:
    """Every service module (except ``__init__``) has a unit test module."""

    services_dir = Path(__file__).resolve().parents[3] / "app" / "services"
    tests_dir = Path(__file__).resolve().parent

    service_modules = sorted(
        p.stem
        for p in services_dir.glob("*.py")
        if p.name != "__init__.py" and not p.name.startswith("_")
    )

    for name in service_modules:
        test_file = tests_dir / f"test_{name}.py"

        assert test_file.is_file(), (
            f"Missing unit tests for app.services.{name}: "
            f"expected {test_file.name}"
        )
