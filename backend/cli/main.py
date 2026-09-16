"""``vp-cli`` entry point — centralized management commands."""

# pylint: disable=unused-argument

from __future__ import annotations

from typing import Annotated, Optional

import typer

from cli import __version__
from cli.commands import elasticsearch, recommendations


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
) -> None:
    """Root callback for global options."""


def main() -> None:
    """Console-script entry point."""

    app()


if __name__ == "__main__":
    main()
