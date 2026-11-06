"""Shared console output and verbosity controls for ``vp-cli``."""

from __future__ import annotations

import logging
from dataclasses import dataclass

import typer


@dataclass
class ConsoleOptions:
    """Runtime flags shared by every ``vp-cli`` command."""

    quiet: bool = False
    verbose: bool = False
    yes: bool = False


_OPTIONS = ConsoleOptions()


def options() -> ConsoleOptions:
    """Return the active console options instance."""

    return _OPTIONS


def is_quiet() -> bool:
    """Return whether quiet mode is active."""

    return _OPTIONS.quiet


def is_verbose() -> bool:
    """Return whether verbose mode is active."""

    return _OPTIONS.verbose


def is_yes() -> bool:
    """Return whether prompts should auto-confirm."""

    return _OPTIONS.yes


def configure(
    *,
    quiet: bool = False,
    verbose: bool = False,
    yes: bool = False,
) -> ConsoleOptions:
    """Apply global quiet / verbose / yes flags and configure logging.

    Quiet suppresses normal informational output (errors and summaries still
    print). Verbose enables extra detail and raises library log levels.
    Quiet and verbose cannot both be true. ``yes`` skips interactive prompts.
    """

    if quiet and verbose:
        raise typer.BadParameter("Cannot combine --quiet and --verbose.")

    _OPTIONS.quiet = quiet
    _OPTIONS.verbose = verbose
    _OPTIONS.yes = yes
    _configure_logging(quiet=quiet, verbose=verbose)

    return _OPTIONS


def _configure_logging(*, quiet: bool, verbose: bool) -> None:
    """Set root and library logger levels from console flags."""

    root = logging.getLogger()

    if not root.handlers:
        logging.basicConfig(
            level=logging.WARNING,
            format="%(levelname)s %(name)s: %(message)s",
        )

    if quiet:
        root.setLevel(logging.ERROR)
        logging.getLogger("sqlalchemy.engine").setLevel(logging.ERROR)
        logging.getLogger("sqlalchemy.pool").setLevel(logging.ERROR)
        return

    if verbose:
        root.setLevel(logging.DEBUG)
        logging.getLogger("sqlalchemy.engine").setLevel(logging.INFO)
        logging.getLogger("sqlalchemy.pool").setLevel(logging.DEBUG)
        logging.getLogger("cli").setLevel(logging.DEBUG)
        return

    root.setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.pool").setLevel(logging.WARNING)
    logging.getLogger("cli").setLevel(logging.INFO)


def echo(message: str, *, err: bool = False) -> None:
    """Print an informational line unless quiet mode is on.

    Errors (``err=True``) are always shown.
    """

    if _OPTIONS.quiet and not err:
        return

    typer.echo(message, err=err)


def summary(message: str, *, err: bool = False) -> None:
    """Print a final/summary line even when quiet mode is on."""

    typer.echo(message, err=err)


def verbose(message: str, *, err: bool = False) -> None:
    """Print only when verbose mode is on (and not quiet)."""

    if _OPTIONS.quiet or not _OPTIONS.verbose:
        return

    typer.echo(message, err=err)


def error(message: str) -> None:
    """Print an error line to stderr (never suppressed by quiet)."""

    typer.echo(message, err=True)


def confirm(message: str, *, default: bool = True) -> bool:
    """Interactive yes/no prompt honoring ``--yes``.

    Prompts remain visible under ``--quiet``. With ``--yes``, returns True
    without asking.
    """

    if _OPTIONS.yes:
        return True

    return bool(typer.confirm(message, default=default))
