"""``vp-cli`` entry point — centralized management commands."""

# pylint: disable=unused-argument

from __future__ import annotations

from typing import Annotated, Optional

import typer

from cli import __version__
from cli.commands import (
    elasticsearch,
    images,
    recommendations,
    user,
    video_upload,
)
from cli.console import configure as configure_console


def _version_callback(value: bool) -> None:
    """Print the CLI version and exit when ``--version`` is passed."""

    if value:
        typer.echo(f"vp-cli {__version__}")
        raise typer.Exit()


app = typer.Typer(
    name="vp-cli",
    help="Video pipeline management CLI.",
    no_args_is_help=True,
    add_completion=True,
)

app.add_typer(recommendations.app, name="recommendations")
app.add_typer(elasticsearch.app, name="elasticsearch")
app.add_typer(user.app, name="user")
app.add_typer(video_upload.app, name="video-upload")
app.add_typer(images.app, name="images")


@app.callback()
def main_callback(
    version: Annotated[
        Optional[bool],
        typer.Option(
            "--version",
            help="Show version and exit.",
            callback=_version_callback,
            is_eager=True,
        ),
    ] = None,
    quiet: Annotated[
        bool,
        typer.Option(
            "--quiet",
            "-q",
            help=(
                "Disable informational log output "
                "(errors and summaries still print)."
            ),
        ),
    ] = False,
    verbose: Annotated[
        bool,
        typer.Option(
            "--verbose",
            "-v",
            help="Show extra logs (worker addresses, database SQL, debug).",
        ),
    ] = False,
    yes: Annotated[
        bool,
        typer.Option(
            "--yes",
            "-y",
            help="Bypass interactive prompts and assume yes.",
        ),
    ] = False,
) -> None:
    """Root callback for global options."""

    configure_console(quiet=quiet, verbose=verbose, yes=yes)


def main() -> None:
    """Console-script entry point."""

    app()


if __name__ == "__main__":
    main()
