"""Image processing commands for ``vp-cli``."""

# pylint: disable=too-many-positional-arguments

from __future__ import annotations

from pathlib import Path
from typing import Annotated, Optional

import typer

from cli.console import echo, error, is_verbose, summary, verbose
from cli.images import run_rename_batch, run_upscale_batch
from cli.images.rename import RenameResult
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

    mode = "DNN model" if model is not None else "Lanczos resize"

    def job_prefix(slot: int, worker_pid: int) -> str:
        if is_verbose() and worker_pid > 0:
            return f"[Job {slot}@{worker_pid}]"

        return f"[Job {slot}]"

    def on_start(_index: int, _total: int, source: Path) -> None:
        echo(f"[queued] start  {source.name}")
        verbose(f"[queued] path={source}")

    def on_result(_index: int, _total: int, result: UpscaleResult) -> None:
        slot = result.worker_slot if result.worker_slot > 0 else 1
        prefix = job_prefix(slot, result.worker_pid)

        if result.ok:
            echo(
                f"{prefix} OK    {result.source.name} -> "
                f"{result.destination} ({result.message})",
            )
            verbose(
                f"{prefix} worker_pid={result.worker_pid} "
                f"source={result.source}",
            )
        else:
            error(f"{prefix} ERR   {result.source.name}: {result.message}")

    echo(
        f"Upscaling from {input_dir} -> {output_dir} "
        f"(width={width}, mode={mode}, workers={jobs})",
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
        error(str(exc))

        raise typer.Exit(code=1) from exc

    if not results:
        echo(f"No images found in {input_dir}")

        raise typer.Exit(code=0)

    failures = sum(1 for result in results if not result.ok)

    echo(
        f"Done: {len(results) - failures} succeeded, {failures} failed "
        f"({'parallel process pool' if jobs > 1 else 'serial'}).",
    )

    if failures:
        raise typer.Exit(code=1)


@app.command("rename")
def rename_command(
    folder: Annotated[
        Path,
        typer.Argument(
            exists=True,
            file_okay=False,
            dir_okay=True,
            readable=True,
            resolve_path=True,
            help="Folder containing images to rename.",
        ),
    ],
    prefix: Annotated[
        str,
        typer.Argument(help="Filename prefix for renamed images."),
    ],
    offset: Annotated[
        int,
        typer.Option(
            "--offset",
            "-o",
            min=1,
            help=(
                "Starting index for the sequence. Images are numbered "
                "from OFFSET through OFFSET + n - 1."
            ),
        ),
    ] = 1,
    directory: Annotated[
        Optional[Path],
        typer.Option(
            "--directory",
            "-d",
            file_okay=False,
            dir_okay=True,
            resolve_path=True,
            help=(
                "Output folder for renamed files. Defaults to FOLDER. "
                "Prompts to create the path when it does not exist."
            ),
        ),
    ] = None,
    preserve: Annotated[
        bool,
        typer.Option(
            "--preserve",
            "-p",
            help=(
                "Keep original files (copy instead of move). "
                "Skip when the destination already exists."
            ),
        ),
    ] = False,
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
    """Rename images in FOLDER to ``PREFIX-<i>.<ext>``."""

    output_dir = directory if directory is not None else folder
    mode = "preserve/copy" if preserve else "rename/move"

    echo(
        f"Renaming images in {folder} "
        f"(prefix={prefix!r}, offset={offset}, output={output_dir}, "
        f"mode={mode}, workers={jobs})",
    )

    failures = 0
    completed = 0

    def on_result(result: RenameResult) -> None:
        nonlocal failures, completed

        completed += 1
        _log_rename_result(result)

        if not result.ok:
            failures += 1

    try:
        results = run_rename_batch(
            folder=folder,
            prefix=prefix,
            offset=offset,
            output_dir=output_dir,
            preserve=preserve,
            jobs=jobs,
            prompt_create=True,
            on_result=on_result,
        )
    except ValueError as exc:
        error(str(exc))

        raise typer.Exit(code=1) from exc
    except typer.Abort as exc:
        error("Cancelled: output directory was not created.")

        raise typer.Exit(code=1) from exc

    if not results:
        summary(f"No images found in {folder}")

        raise typer.Exit(code=0)

    summary(
        f"Done: {len(results) - failures} succeeded, {failures} failed"
        f"{' (parallel process pool)' if jobs > 1 else ''}.",
    )

    if failures:
        raise typer.Exit(code=1)


def _log_rename_result(result: RenameResult) -> None:
    """Print one rename outcome using default or verbose patterns."""

    status = result.status if result.ok else "ERR"

    if is_verbose():
        slot = result.worker_slot if result.worker_slot > 0 else 1
        address = (
            str(result.worker_pid) if result.worker_pid > 0 else "unknown"
        )
        line = (
            f"[Job {slot}@{address}]"
            f"[{result.ordinal}/{result.total}] {status}  "
            f"{result.source} -> {result.destination}"
        )

        if result.ok:
            echo(line)
        else:
            error(line)
            error(result.message)

        return

    line = (
        f"[{result.index}] {status}  "
        f"{result.source.name} -> {result.destination.name}"
    )

    if result.ok:
        echo(line)
    else:
        error(line)
        error(result.message)
