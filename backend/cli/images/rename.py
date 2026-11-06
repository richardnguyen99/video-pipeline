"""Sequential and parallel image rename helpers for ``vp-cli images rename``."""

from __future__ import annotations

import os
import re
import shutil
import uuid
from collections.abc import Callable
from concurrent.futures import Future, ProcessPoolExecutor, as_completed
from dataclasses import dataclass
from multiprocessing import current_process
from pathlib import Path

from cli.console import confirm
from cli.images.upscale import collect_image_files

_WORKER_NAME_SLOT_RE = re.compile(r"(\d+)$")


@dataclass(frozen=True)
class RenamePlanItem:
    """One planned source → destination rename."""

    source: Path
    destination: Path
    index: int
    ordinal: int
    total: int


@dataclass(frozen=True)
class RenameResult:
    """Outcome of applying one rename."""

    source: Path
    destination: Path
    index: int
    ordinal: int
    total: int
    ok: bool
    message: str
    status: str
    worker_pid: int = 0
    worker_slot: int = 1


def ensure_output_directory(
    directory: Path,
    *,
    prompt: bool = True,
) -> Path:
    """Return ``directory``, creating it when missing and allowed."""

    if directory.exists():
        if not directory.is_dir():
            raise ValueError(f"Output path is not a directory: {directory}")

        return directory

    if prompt:
        if confirm(f"Directory {directory} does not exist. Create it?"):
            directory.mkdir(parents=True, exist_ok=True)

    if not directory.exists():
        raise ValueError(
            f"Output directory does not exist: {directory}. "
            "Create it and retry.",
        )

    if not directory.is_dir():
        raise ValueError(f"Output path is not a directory: {directory}")

    return directory


def build_rename_plan(
    folder: Path,
    prefix: str,
    *,
    offset: int,
    output_dir: Path,
) -> list[RenamePlanItem]:
    """Build a sequential rename plan for images under ``folder``."""

    if offset < 1:
        raise ValueError("--offset must be a positive integer (>= 1).")

    cleaned_prefix = prefix.strip()

    if not cleaned_prefix:
        raise ValueError("PREFIX must be a non-empty string.")

    sources = collect_image_files(folder)

    if not sources:
        return []

    total = len(sources)
    plan: list[RenamePlanItem] = []

    for position, source in enumerate(sources):
        index = offset + position
        extension = source.suffix.lower()
        destination = output_dir / f"{cleaned_prefix}-{index}{extension}"
        plan.append(
            RenamePlanItem(
                source=source,
                destination=destination,
                index=index,
                ordinal=position + 1,
                total=total,
            ),
        )

    return plan


def resolve_worker_slot() -> int:
    """Return the 1-based pool worker index for the current process."""

    match = _WORKER_NAME_SLOT_RE.search(current_process().name)

    if match is None:
        return 1

    return max(1, int(match.group(1)))


def _apply_via_temp(source: Path, destination: Path) -> None:
    """Move ``source`` to ``destination`` using a unique temp name."""

    if source.resolve() == destination.resolve():
        return

    destination.parent.mkdir(parents=True, exist_ok=True)
    temp_name = (
        destination.parent
        / f".vp-rename-{uuid.uuid4().hex}{source.suffix.lower()}"
    )

    source.rename(temp_name)

    try:
        if destination.exists():
            destination.unlink()

        temp_name.rename(destination)
    except OSError:
        if temp_name.exists() and not source.exists():
            temp_name.rename(source)

        raise


def apply_one(
    item: RenamePlanItem,
    *,
    preserve: bool,
) -> RenameResult:
    """Apply a single rename/copy plan item."""

    worker_pid = os.getpid()
    worker_slot = resolve_worker_slot()

    try:
        if item.source.resolve() == item.destination.resolve():
            return RenameResult(
                source=item.source,
                destination=item.destination,
                index=item.index,
                ordinal=item.ordinal,
                total=item.total,
                ok=True,
                message="unchanged",
                status="SKIP",
                worker_pid=worker_pid,
                worker_slot=worker_slot,
            )

        if item.destination.exists():
            if preserve:
                return RenameResult(
                    source=item.source,
                    destination=item.destination,
                    index=item.index,
                    ordinal=item.ordinal,
                    total=item.total,
                    ok=True,
                    message="destination exists; skipped",
                    status="SKIP",
                    worker_pid=worker_pid,
                    worker_slot=worker_slot,
                )

        if preserve:
            item.destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(item.source, item.destination)
            status = "COPY"
            message = "copied"
        else:
            same_parent = (
                item.source.resolve().parent
                == item.destination.resolve().parent
            )

            if same_parent:
                _apply_via_temp(item.source, item.destination)
            else:
                item.destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(item.source, item.destination)
                item.source.unlink()

            status = "OK"
            message = "renamed"

        return RenameResult(
            source=item.source,
            destination=item.destination,
            index=item.index,
            ordinal=item.ordinal,
            total=item.total,
            ok=True,
            message=message,
            status=status,
            worker_pid=worker_pid,
            worker_slot=worker_slot,
        )
    except OSError as exc:
        return RenameResult(
            source=item.source,
            destination=item.destination,
            index=item.index,
            ordinal=item.ordinal,
            total=item.total,
            ok=False,
            message=str(exc),
            status="ERR",
            worker_pid=worker_pid,
            worker_slot=worker_slot,
        )


def _process_payload(
    payload: tuple[str, str, int, int, int, bool],
) -> RenameResult:
    """Process-pool entry point (picklable arguments only)."""

    source_s, destination_s, index, ordinal, total, preserve = payload
    item = RenamePlanItem(
        source=Path(source_s),
        destination=Path(destination_s),
        index=index,
        ordinal=ordinal,
        total=total,
    )

    return apply_one(item, preserve=preserve)


def _run_serial(
    plan: list[RenamePlanItem],
    *,
    preserve: bool,
    on_result: Callable[[RenameResult], None] | None,
) -> list[RenameResult]:
    """Apply the plan on the current process."""

    results: list[RenameResult] = []

    for item in plan:
        result = apply_one(item, preserve=preserve)
        results.append(result)

        if on_result is not None:
            on_result(result)

    return results


def _run_parallel(
    plan: list[RenamePlanItem],
    *,
    preserve: bool,
    jobs: int,
    on_result: Callable[[RenameResult], None] | None,
) -> list[RenameResult]:
    """Apply the plan with a process pool."""

    results: list[RenameResult] = []
    payloads = [
        (
            str(item.source),
            str(item.destination),
            item.index,
            item.ordinal,
            item.total,
            preserve,
        )
        for item in plan
    ]

    with ProcessPoolExecutor(max_workers=jobs) as executor:
        futures: dict[Future[RenameResult], RenamePlanItem] = {}

        for item, payload in zip(plan, payloads, strict=True):
            future = executor.submit(_process_payload, payload)
            futures[future] = item

        for future in as_completed(futures):
            result = future.result()
            results.append(result)

            if on_result is not None:
                on_result(result)

    results.sort(key=lambda item: item.ordinal)

    return results


def run_rename_batch(
    *,
    folder: Path,
    prefix: str,
    offset: int,
    output_dir: Path,
    preserve: bool = False,
    jobs: int = 1,
    prompt_create: bool = True,
    on_result: Callable[[RenameResult], None] | None = None,
) -> list[RenameResult]:
    """Validate paths, build a plan, and rename or copy images."""

    if not folder.is_dir():
        raise ValueError(f"Folder does not exist: {folder}")

    if jobs < 1:
        raise ValueError("jobs must be at least 1.")

    target = ensure_output_directory(output_dir, prompt=prompt_create)
    plan = build_rename_plan(
        folder,
        prefix,
        offset=offset,
        output_dir=target,
    )

    if not plan:
        return []

    worker_count = min(jobs, len(plan))

    if worker_count <= 1:
        return _run_serial(plan, preserve=preserve, on_result=on_result)

    return _run_parallel(
        plan,
        preserve=preserve,
        jobs=worker_count,
        on_result=on_result,
    )
