"""Batch image upscaling with optional OpenCV DNN super-resolution."""

from __future__ import annotations

import os
import re
from collections.abc import Callable
from concurrent.futures import Future, ProcessPoolExecutor, as_completed
from dataclasses import dataclass
from multiprocessing import current_process
from pathlib import Path
from typing import cast

import cv2
import numpy as np

_WORKER_NAME_SLOT_RE = re.compile(r"(\d+)$")

_IMAGE_SUFFIXES = frozenset(
    {
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
        ".bmp",
        ".tif",
        ".tiff",
    },
)

_MODEL_SCALE_RE = re.compile(
    r"(?:x|_|-)(\d)(?:\.|$)",
    re.IGNORECASE,
)

_MODEL_ALGO_ALIASES: dict[str, str] = {
    "edsr": "edsr",
    "espcn": "espcn",
    "fsrcnn": "fsrcnn",
    "lapsrn": "lapsrn",
}

# DNN super-resolution (especially EDSR) is memory-heavy on full frames.
# Process fixed-size tiles with overlap so large inputs stay within RAM.
_DEFAULT_TILE_SIZE = 256
_DEFAULT_TILE_OVERLAP = 24


@dataclass(frozen=True)
class UpscaleJob:
    """One input image and its destination path."""

    source: Path
    destination: Path


@dataclass(frozen=True)
class UpscaleResult:
    """Outcome of a single upscale job."""

    source: Path
    destination: Path
    ok: bool
    message: str
    worker_pid: int = 0
    worker_slot: int = 1


def natural_sort_key(path: Path) -> list[object]:
    """Sort key that orders embedded numbers numerically (1, 2, 10 not 1, 10, 2)."""

    parts = re.split(r"(\d+)", path.name.lower())

    return [int(part) if part.isdigit() else part for part in parts]


def collect_image_files(input_dir: Path) -> list[Path]:
    """Return image files under ``input_dir`` (non-recursive, natural order)."""

    files = [
        path
        for path in input_dir.iterdir()
        if path.is_file() and path.suffix.lower() in _IMAGE_SUFFIXES
    ]

    return sorted(files, key=natural_sort_key)


def build_jobs(input_dir: Path, output_dir: Path) -> list[UpscaleJob]:
    """Map each input image to a same-named path under ``output_dir``."""

    return [
        UpscaleJob(source=path, destination=output_dir / path.name)
        for path in collect_image_files(input_dir)
    ]


def infer_model_algorithm(model_path: Path) -> str:
    """Guess DNN algorithm name from the model filename."""

    stem = model_path.stem.lower()

    for key, value in _MODEL_ALGO_ALIASES.items():
        if key in stem:
            return value

    raise ValueError(
        f"Cannot infer super-resolution algorithm from model name "
        f"'{model_path.name}'. Expected a filename containing one of: "
        f"{', '.join(sorted(_MODEL_ALGO_ALIASES))}."
    )


def infer_model_scale(model_path: Path) -> int:
    """Guess scale factor (2–4) from the model filename."""

    match = _MODEL_SCALE_RE.search(model_path.stem)

    if match is None:
        raise ValueError(
            f"Cannot infer scale from model name '{model_path.name}'. "
            "Expected a marker like x2, x3, or x4 in the filename."
        )

    scale = int(match.group(1))

    if scale not in {2, 3, 4}:
        raise ValueError(
            f"Unsupported model scale {scale} in '{model_path.name}'. "
            "Only 2, 3, and 4 are supported."
        )

    return scale


def target_size(width: int, height: int, target_width: int) -> tuple[int, int]:
    """Return ``(target_width, target_height)`` preserving aspect ratio."""

    if width <= 0 or height <= 0:
        raise ValueError("Image dimensions must be positive.")

    if target_width <= 0:
        raise ValueError("Target width must be a positive integer.")

    target_height = max(1, int(round(height * (target_width / width))))

    return target_width, target_height


def load_bgr_image(path: Path) -> np.ndarray:
    """Read an image as a BGR ``ndarray``."""

    image = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)

    if image is None:
        raise ValueError(f"Failed to read image: {path}")

    return image


def save_image(path: Path, image: np.ndarray) -> None:
    """Write ``image`` to ``path``, creating parent directories as needed."""

    path.parent.mkdir(parents=True, exist_ok=True)
    ok = cv2.imwrite(str(path), image)

    if not ok:
        raise ValueError(f"Failed to write image: {path}")


def resize_traditional(image: np.ndarray, target_width: int) -> np.ndarray:
    """Upscale (or downscale) with Lanczos while keeping aspect ratio."""

    height, width = image.shape[:2]
    new_width, new_height = target_size(width, height, target_width)

    if new_width == width and new_height == height:
        return image

    interpolation = (
        cv2.INTER_LANCZOS4
        if new_width > width or new_height > height
        else cv2.INTER_AREA
    )

    return cv2.resize(
        image,
        (new_width, new_height),
        interpolation=interpolation,
    )


def _create_super_resolution() -> object:
    """Construct an OpenCV DNN super-resolution instance.

    ``cv2.dnn_superres`` is a C-extension module; attribute access is resolved
    at runtime so static analyzers do not report false no-member findings.
    """

    module = getattr(cv2, "dnn_superres", None)

    if module is None:
        raise ValueError(
            "OpenCV build has no dnn_superres module. "
            "Install opencv-contrib-python-headless."
        )

    factory = getattr(module, "DnnSuperResImpl_create", None)

    if factory is None:
        impl = getattr(module, "DnnSuperResImpl", None)
        factory = getattr(impl, "create", None) if impl is not None else None

    if factory is None:
        raise ValueError(
            "OpenCV dnn_superres API is unavailable in this build."
        )

    return factory()


def ensure_bgr_u8(image: np.ndarray) -> np.ndarray:
    """Normalize inputs to 8-bit 3-channel BGR for DNN super-resolution."""

    working = image

    if working.dtype != np.uint8:
        working = np.clip(working, 0, 255).astype(np.uint8)

    if working.ndim == 2:
        return cv2.cvtColor(working, cv2.COLOR_GRAY2BGR)

    channels = working.shape[2]

    if channels == 4:
        return cv2.cvtColor(working, cv2.COLOR_BGRA2BGR)

    if channels == 3:
        return working

    raise ValueError(f"Unsupported image channel count: {channels}")


def prepare_input_for_model(
    image: np.ndarray,
    scale: int,
    target_width: int,
) -> np.ndarray:
    """Shrink oversized inputs so model output is near the target width.

    Feeding a full 4K frame into EDSRx4 balloons memory. When the requested
    width is smaller than ``width * scale``, downscale first so the network
    only expands what is needed.
    """

    height, width = image.shape[:2]
    max_useful_width = max(1, int((target_width + scale - 1) // scale))

    if width > max_useful_width:
        return resize_traditional(image, max_useful_width)

    if height * width > max_useful_width * max_useful_width * 4:
        # Extremely tall sources still dominate memory; cap by width path above.
        return image

    return image


def _tile_starts(length: int, tile_size: int, stride: int) -> list[int]:
    """Return ordered start offsets covering ``length`` with ``tile_size`` windows."""

    starts = list(range(0, length, stride))

    if starts[-1] + tile_size < length:
        starts.append(max(0, length - tile_size))

    return starts


def _allocate_upscaled_canvas(image: np.ndarray, scale: int) -> np.ndarray:
    """Allocate the full-resolution buffer for tiled upscaling."""

    height, width = image.shape[:2]
    channels = image.shape[2] if image.ndim == 3 else 1

    return np.zeros(
        (height * scale, width * scale, channels),
        dtype=np.uint8,
    )


def _paste_upscaled_tile(
    output: np.ndarray,
    up_tile: np.ndarray,
    y0: int,
    x0: int,
    scale: int,
) -> None:
    """Write one upscaled tile into ``output`` at the scaled origin."""

    out_y0 = y0 * scale
    out_x0 = x0 * scale
    out_y1 = out_y0 + up_tile.shape[0]
    out_x1 = out_x0 + up_tile.shape[1]
    output[out_y0:out_y1, out_x0:out_x1] = up_tile


def upsample_tiled(
    image: np.ndarray,
    upsample: Callable[[np.ndarray], np.ndarray],
    scale: int,
    tile_size: int = _DEFAULT_TILE_SIZE,
    overlap: int = _DEFAULT_TILE_OVERLAP,
) -> np.ndarray:
    """Upscale ``image`` tile-by-tile to limit peak memory usage."""

    height, width = image.shape[:2]

    if height <= tile_size and width <= tile_size:
        return upsample(image)

    safe_overlap = max(0, min(overlap, tile_size // 4))
    stride = max(1, tile_size - safe_overlap)
    output = _allocate_upscaled_canvas(image, scale)

    for y0 in _tile_starts(height, tile_size, stride):
        y1 = min(y0 + tile_size, height)

        for x0 in _tile_starts(width, tile_size, stride):
            x1 = min(x0 + tile_size, width)
            up_tile = upsample(image[y0:y1, x0:x1])
            _paste_upscaled_tile(output, up_tile, y0, x0, scale)

    return output


def _bind_model_upsample(
    model_path: Path,
) -> tuple[Callable[[np.ndarray], np.ndarray], int]:
    """Load a DNN super-resolution model and return ``(upsample, scale)``."""

    algorithm = infer_model_algorithm(model_path)
    scale = infer_model_scale(model_path)
    sr = _create_super_resolution()
    read_model = getattr(sr, "readModel")
    set_model = getattr(sr, "setModel")
    upsample_fn = getattr(sr, "upsample")
    read_model(str(model_path))
    set_model(algorithm, scale)

    def _upsample_tile(tile: np.ndarray) -> np.ndarray:
        return cast(np.ndarray, upsample_fn(tile))

    return _upsample_tile, scale


def upscale_with_model(
    image: np.ndarray,
    model_path: Path,
    target_width: int,
    tile_size: int = _DEFAULT_TILE_SIZE,
    overlap: int = _DEFAULT_TILE_OVERLAP,
) -> np.ndarray:
    """Run OpenCV DNN super-resolution, then fit exact target width.

    Large frames are pre-shrunk when possible and processed in overlapping
    tiles so models like EDSR do not exhaust process memory.
    """

    upsample_fn, scale = _bind_model_upsample(model_path)
    prepared = ensure_bgr_u8(image)
    prepared = prepare_input_for_model(prepared, scale, target_width)

    try:
        upscaled = upsample_tiled(
            prepared,
            upsample_fn,
            scale=scale,
            tile_size=tile_size,
            overlap=overlap,
        )
    except MemoryError as exc:
        raise ValueError(
            "Out of memory while running the super-resolution model. "
            "Try a smaller --width, a lighter model (FSRCNN/ESPCN), "
            "or omit --model for traditional resize."
        ) from exc

    return resize_traditional(upscaled, target_width)


def resolve_worker_slot() -> int:
    """Return the 1-based pool worker index for the current process.

    ``ProcessPoolExecutor`` names workers ``ForkProcess-1``, ``SpawnProcess-2``,
    etc. The trailing number is the worker slot. The main process (serial path)
    falls back to slot ``1``.
    """

    match = _WORKER_NAME_SLOT_RE.search(current_process().name)

    if match is None:
        return 1

    return max(1, int(match.group(1)))


def process_one_image(
    source: Path,
    destination: Path,
    target_width: int,
    model_path: Path | None,
) -> UpscaleResult:
    """Upscale a single image to ``destination``."""

    worker_pid = os.getpid()
    worker_slot = resolve_worker_slot()

    try:
        image = load_bgr_image(source)

        if model_path is None:
            result = resize_traditional(image, target_width)
        else:
            result = upscale_with_model(image, model_path, target_width)

        save_image(destination, result)

        height, width = result.shape[:2]

        return UpscaleResult(
            source=source,
            destination=destination,
            ok=True,
            message=f"{width}x{height}",
            worker_pid=worker_pid,
            worker_slot=worker_slot,
        )
    except MemoryError:
        return UpscaleResult(
            source=source,
            destination=destination,
            ok=False,
            message=(
                "Out of memory while upscaling. "
                "Try a smaller --width, a lighter model, or omit --model."
            ),
            worker_pid=worker_pid,
            worker_slot=worker_slot,
        )
    except (ValueError, OSError, cv2.error) as exc:
        return UpscaleResult(
            source=source,
            destination=destination,
            ok=False,
            message=str(exc),
            worker_pid=worker_pid,
            worker_slot=worker_slot,
        )


def _process_job_payload(
    payload: tuple[str, str, int, str | None],
) -> UpscaleResult:
    """Process-pool entry point (picklable arguments only)."""

    source_s, destination_s, target_width, model_s = payload
    model_path = Path(model_s) if model_s is not None else None

    return process_one_image(
        Path(source_s),
        Path(destination_s),
        target_width,
        model_path,
    )


def _validate_batch_args(
    input_dir: Path,
    target_width: int,
    jobs: int,
    model_path: Path | None,
) -> None:
    """Raise ``ValueError`` when batch arguments are invalid."""

    if not input_dir.is_dir():
        raise ValueError(f"Input directory does not exist: {input_dir}")

    if target_width <= 0:
        raise ValueError("Target width must be a positive integer.")

    if jobs < 1:
        raise ValueError("jobs must be at least 1.")

    if model_path is not None and not model_path.is_file():
        raise ValueError(f"Model file does not exist: {model_path}")


def _build_payloads(
    work: list[UpscaleJob],
    target_width: int,
    model_path: Path | None,
) -> list[tuple[str, str, int, str | None]]:
    """Serialize jobs into picklable worker payloads."""

    model_s = str(model_path) if model_path is not None else None

    return [
        (str(job.source), str(job.destination), target_width, model_s)
        for job in work
    ]


def _run_serial(
    payloads: list[tuple[str, str, int, str | None]],
    on_start: Callable[[int, int, Path], None] | None,
    on_result: Callable[[int, int, UpscaleResult], None] | None,
) -> list[UpscaleResult]:
    """Process payloads on the current process (always worker slot 1)."""

    total = len(payloads)
    results: list[UpscaleResult] = []

    for index, payload in enumerate(payloads, start=1):
        source = Path(payload[0])

        if on_start is not None:
            on_start(index, total, source)

        result = _process_job_payload(payload)
        results.append(result)

        if on_result is not None:
            on_result(index, total, result)

    return results


def _run_parallel(
    payloads: list[tuple[str, str, int, str | None]],
    jobs: int,
    on_start: Callable[[int, int, Path], None] | None,
    on_result: Callable[[int, int, UpscaleResult], None] | None,
) -> list[UpscaleResult]:
    """Process payloads with a process pool.

    Worker slot numbers come from the process name assigned by the pool
    (``ForkProcess-1``, ``SpawnProcess-2``, …), not from the image ordinal.
    """

    total = len(payloads)
    results: list[UpscaleResult] = []

    with ProcessPoolExecutor(max_workers=jobs) as executor:
        future_meta: dict[Future[UpscaleResult], tuple[int, Path]] = {}

        for index, payload in enumerate(payloads, start=1):
            source = Path(payload[0])

            if on_start is not None:
                on_start(index, total, source)

            future = executor.submit(_process_job_payload, payload)
            future_meta[future] = (index, source)

        for future in as_completed(future_meta):
            index, _source = future_meta[future]
            result = future.result()
            results.append(result)

            if on_result is not None:
                on_result(index, total, result)

    results.sort(key=lambda item: str(item.source))

    return results


def run_upscale_batch(
    *,
    input_dir: Path,
    output_dir: Path,
    target_width: int,
    model_path: Path | None,
    jobs: int,
    on_start: Callable[[int, int, Path], None] | None = None,
    on_result: Callable[[int, int, UpscaleResult], None] | None = None,
) -> list[UpscaleResult]:
    """Upscale all images in ``input_dir`` into ``output_dir``.

    Optional callbacks:
    * ``on_start(index, total, source)`` — when a job is submitted / begins
    * ``on_result(index, total, result)`` — after each image finishes

    ``jobs`` is the process-pool size. Values greater than 1 always use
    ``ProcessPoolExecutor`` so multiple images are processed concurrently
    (including when a DNN ``model_path`` is set).
    """

    _validate_batch_args(input_dir, target_width, jobs, model_path)
    output_dir.mkdir(parents=True, exist_ok=True)
    work = build_jobs(input_dir, output_dir)

    if not work:
        return []

    payloads = _build_payloads(work, target_width, model_path)
    worker_count = min(jobs, len(payloads))

    if worker_count <= 1:
        return _run_serial(payloads, on_start, on_result)

    return _run_parallel(payloads, worker_count, on_start, on_result)
