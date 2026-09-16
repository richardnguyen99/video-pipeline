"""Helpers for running async command bodies from Typer."""

from __future__ import annotations

import asyncio
from collections.abc import Coroutine
from typing import TypeVar

T = TypeVar("T")


def run_async(coro: Coroutine[object, object, T]) -> T:
    """Run an async coroutine from a synchronous Typer command."""

    return asyncio.run(coro)
