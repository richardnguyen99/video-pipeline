"""Image processing commands for ``vp-cli``."""

from __future__ import annotations

from pathlib import Path
from typing import Annotated, Optional

import typer

from cli.images import run_upscale_batch
from cli.images.upscale import UpscaleResult

app = typer.Typer(
    name="images",
    help="Image processing utilities.",
    no_args_is_help=True,
)


@app.command("upscale")
def upscale_command(
    input_dir: Annotated[
        Path,
        typer.Argument(
            exists=True,
            file_okay=False,
            dir_okay=True,
            readable=True,
            resolve_path=True,
            help="Directory containing source images.",
        ),
    ],
    output_dir: Annotated[
        Path,
        typer.Argument(
            file_okay=False,
            dir_okay=True,
            resolve_path=True,
            help="Directory where upscaled images are written.",
        ),
    ],
    width: Annotated[
        int,
        typer.Option(
            "--width",
            "-w",
            min=1,
            help="Target width in pixels. Height follows the source aspect ratio.",
        ),
    ],
    model: Annotated[
        Optional[Path],
        typer.Option(
            "--model",
            "-m",
            exists=True,
            file_okay=True,
            dir_okay=False,
            readable=True,
            resolve_path=True,
            help=(
                "OpenCV DNN super-resolution model path "
                "(e.g. EDSR_x4.pb). Omit for traditional Lanczos resize."
            ),
        ),
    ] = None,
    jobs: Annotated[
        int,
        typer.Option(
            "--jobs",
            "-j",
            min=1,
            help="Number of parallel worker processes.",
        ),
    ] = 1,
) -> None:
    """Upscale images from INPUT_DIR into OUTPUT_DIR.

    Always preserves aspect ratio. Without ``--model``, uses high-quality
    traditional resizing. With ``--model``, runs OpenCV DNN super-resolution
    first, then fits the requested width.
    """

    def on_start(index: int, total: int, source: Path) -> None:
        typer.echo(f"[{index}/{total}] Working {source.name}…")

    def on_result(index: int, total: int, result: UpscaleResult) -> None:
        if result.ok:
            typer.echo(
                f"[{index}/{total}] OK  {result.source.name} -> "
                f"{result.destination} ({result.message})",
            )
        else:
            typer.echo(
                f"[{index}/{total}] ERR {result.source.name}: {result.message}",
                err=True,
            )

    try:
        results = run_upscale_batch(
            input_dir=input_dir,
            output_dir=output_dir,
            target_width=width,
            model_path=model,
            jobs=jobs,
            on_start=on_start,
            on_result=on_result,
        )
    except ValueError as exc:
        typer.echo(str(exc), err=True)

        raise typer.Exit(code=1) from exc

    if not results:
        typer.echo(f"No images found in {input_dir}")

        raise typer.Exit(code=0)

    failures = sum(1 for result in results if not result.ok)

    typer.echo(
        f"Done: {len(results) - failures} succeeded, {failures} failed.",
    )

    if failures:
        raise typer.Exit(code=1)
