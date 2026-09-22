"""User data generation and population commands."""

from __future__ import annotations

import csv
import json
import logging
import os
import re
import sys
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Annotated, Any, Iterator, Optional, TextIO

import typer
from faker import Factory
from sqlalchemy.exc import IntegrityError

from app.models.user import User
from app.repositories.user import UserRepository
from app.utils.password import PASSWORD_ALGORITHM, hash_password
from cli.async_utils import run_async
from cli.db import session_scope

_USERNAME_SAFE = re.compile(r"[^A-Za-z0-9_]")
_FIELDNAMES = ("username", "email", "password", "display_name")
_LOGS_DIR = Path(__file__).resolve().parents[2] / "logs"


class OutputFormat(str, Enum):
    """Supported serialization formats for generated users."""

    CSV = "csv"
    TSV = "tsv"
    JSON = "json"


app = typer.Typer(
    name="user",
    help="Generate and manage synthetic user data.",
    no_args_is_help=True,
)


@dataclass
class UserRecord:
    """One registration-shaped user row from generate/populate input."""

    username: str
    email: str
    password: str
    display_name: Optional[str] = None
    source_index: int = 0


@dataclass
class PopulateStats:
    """Counters for a populate run."""

    inserted: int = 0
    updated: int = 0
    ignored: int = 0
    ignored_rows: list[dict[str, Any]] = field(default_factory=list)


def _sanitize_username(raw: str, *, index: int) -> str:
    """Force username into registration-safe shape (3–50, [A-Za-z0-9_])."""

    cleaned = _USERNAME_SAFE.sub("_", raw.strip()).strip("_")

    if not cleaned:
        cleaned = f"user_{index}"

    if len(cleaned) < 3:
        cleaned = f"{cleaned}_{index:03d}"

    return cleaned[:50]


def _registration_password(fake: Any) -> str:
    """Build a password that satisfies registration strength rules."""

    return str(
        fake.password(
            length=12,
            special_chars=True,
            digits=True,
            upper_case=True,
            lower_case=True,
        ),
    )


def generate_users(count: int) -> list[dict[str, str]]:
    """Produce ``count`` unique synthetic registration payloads.

    Args:
        count: Number of users to generate (must be >= 1).

    Returns:
        List of dicts with username, email, password, display_name.
    """

    fake = Factory.create()
    seen_usernames: set[str] = set()
    seen_emails: set[str] = set()
    rows: list[dict[str, str]] = []
    attempt = 0

    while len(rows) < count:
        attempt += 1
        username = _sanitize_username(
            str(fake.user_name()),
            index=attempt,
        )

        if username in seen_usernames:
            username = f"{username}_{attempt}"[:50]

        email = str(fake.email()).strip().lower()

        if email in seen_emails:
            local, _, domain = email.partition("@")
            email = f"{local}+{attempt}@{domain or 'example.com'}"

        seen_usernames.add(username)
        seen_emails.add(email)

        rows.append(
            {
                "username": username,
                "email": email,
                "password": _registration_password(fake),
                "display_name": str(fake.name()),
            },
        )

    return rows


def write_users(
    rows: list[dict[str, str]],
    fmt: OutputFormat,
    stream: TextIO,
) -> None:
    """Serialize generated users to ``stream`` in the chosen format.

    Args:
        rows: Generated user dicts.
        fmt: Output format (csv, tsv, or json).
        stream: Destination text stream (typically stdout).
    """

    if fmt is OutputFormat.JSON:
        json.dump(rows, stream, indent=2, ensure_ascii=False)
        stream.write("\n")

        return

    delimiter = "\t" if fmt is OutputFormat.TSV else ","
    writer = csv.DictWriter(
        stream,
        fieldnames=list(_FIELDNAMES),
        delimiter=delimiter,
        lineterminator="\n",
    )
    writer.writeheader()
    writer.writerows(rows)


def _normalize_record(
    raw: dict[str, Any],
    *,
    index: int,
) -> UserRecord:
    """Map a free-form dict into a ``UserRecord``."""

    username = str(raw.get("username") or "").strip()
    email = str(raw.get("email") or "").strip().lower()
    password = str(raw.get("password") or "")
    display_raw = raw.get("display_name")
    display_name: Optional[str]

    if display_raw is None:
        display_name = None
    else:
        trimmed = str(display_raw).strip()
        display_name = trimmed or None

    if not username or not email or not password:
        raise ValueError(
            f"Row {index}: username, email, and password are required.",
        )

    return UserRecord(
        username=username,
        email=email,
        password=password,
        display_name=display_name,
        source_index=index,
    )


def _parse_tabular(text: str, *, delimiter: str) -> list[UserRecord]:
    """Parse CSV/TSV text into user records."""

    reader = csv.DictReader(
        text.splitlines(),
        delimiter=delimiter,
    )

    if reader.fieldnames is None:
        return []

    records: list[UserRecord] = []

    for index, row in enumerate(reader, start=1):
        cleaned = {
            (key or "").strip(): (value if value is not None else "")
            for key, value in row.items()
        }
        records.append(_normalize_record(cleaned, index=index))

    return records


def parse_user_input(
    text: str, *, source_path: Optional[Path] = None
) -> list[UserRecord]:
    """Parse JSON, CSV, or TSV user payloads from text.

    Format is inferred from ``source_path`` suffix when provided,
    otherwise from content (JSON array vs delimiter-separated).
    """

    stripped = text.strip()

    if not stripped:
        return []

    suffix = source_path.suffix.lower() if source_path is not None else ""

    if suffix == ".json" or stripped.startswith("["):
        payload = json.loads(stripped)

        if not isinstance(payload, list):
            raise ValueError("JSON input must be an array of user objects.")

        return [
            _normalize_record(item, index=index)
            for index, item in enumerate(payload, start=1)
            if isinstance(item, dict)
        ]

    if suffix == ".tsv":
        return _parse_tabular(stripped, delimiter="\t")

    if suffix == ".csv":
        return _parse_tabular(stripped, delimiter=",")

    if "\t" in stripped.splitlines()[0]:
        return _parse_tabular(stripped, delimiter="\t")

    return _parse_tabular(stripped, delimiter=",")


def _tty_candidate_paths() -> list[str]:
    """Return paths that may refer to the controlling terminal.

    Prefer the device behind stderr/stdout (e.g. ``/dev/pts/N`` when data
    is piped on stdin) before the generic ``/dev/tty`` node.
    """

    paths: list[str] = []

    for stream in (sys.stderr, sys.stdout, sys.__stderr__, sys.__stdout__):
        if stream is None:
            continue

        try:
            fd = stream.fileno()
        except OSError, ValueError, AttributeError:
            continue

        try:
            if os.isatty(fd):
                paths.append(os.ttyname(fd))
        except OSError:
            continue

    if hasattr(os, "ctermid"):
        try:
            paths.append(os.ctermid())
        except OSError:
            pass

    paths.append("/dev/tty")

    seen: set[str] = set()
    ordered: list[str] = []

    for path in paths:
        if path and path not in seen:
            seen.add(path)
            ordered.append(path)

    return ordered


def _open_tty_input() -> TextIO:
    """Open the controlling terminal for reading interactive answers."""

    errors: list[str] = []

    for path in _tty_candidate_paths():
        try:
            fd = os.open(path, os.O_RDONLY)
        except OSError as exc:
            errors.append(f"{path}: open failed ({exc})")
            continue

        try:
            return os.fdopen(fd, "r", encoding="utf-8", closefd=True)
        except OSError as exc:
            os.close(fd)
            errors.append(f"{path}: fdopen failed ({exc})")

    detail = "; ".join(errors) if errors else "no candidates"
    raise OSError(f"no controlling terminal available ({detail})")


def restore_stdin_after_pipe() -> None:
    """Rebind ``sys.stdin`` to the TTY after a data pipe was fully read.

    ``cat file | vp-cli …`` leaves stdin at EOF. Prompts must not read that
    pipe; point ``sys.stdin`` at the controlling terminal instead.
    """

    if sys.stdin.isatty():
        return

    tty_in = _open_tty_input()
    previous = sys.stdin

    try:
        previous.close()
    except OSError:
        pass

    sys.stdin = tty_in


def load_user_records(
    *,
    file_path: Optional[Path],
) -> list[UserRecord]:
    """Load user records from ``--file`` or stdin."""

    if file_path is not None:
        text = file_path.read_text(encoding="utf-8")

        return parse_user_input(text, source_path=file_path)

    if sys.stdin.isatty():
        raise typer.BadParameter(
            "Provide --file PATH or pipe user data on stdin.",
        )

    text = sys.stdin.read()
    restore_stdin_after_pipe()

    return parse_user_input(text)


@contextmanager
def _quiet_sqlalchemy_engine() -> Iterator[None]:
    """Mute SQLAlchemy engine SQL logs for the duration of a prompt."""

    logger = logging.getLogger("sqlalchemy.engine")
    previous = logger.level
    logger.setLevel(logging.WARNING)

    try:
        yield
    finally:
        logger.setLevel(previous)


def _confirm(message: str, *, assume_yes: bool) -> bool:
    """Prompt unless ``--yes`` was passed.

    Prompt text goes to stderr (still the terminal when stdin is a pipe).
    The answer is read from the controlling terminal so a drained stdin
    pipe cannot EOF/Abort the command, and SQL log lines on stdout/stderr
    cannot be mistaken for the answer.
    """

    if assume_yes:
        return True

    prompt = f"{message} [y/N]: "

    with _quiet_sqlalchemy_engine():
        sys.stderr.flush()
        sys.stdout.flush()
        sys.stderr.write(prompt)
        sys.stderr.flush()

        if sys.stdin.isatty():
            answer = sys.stdin.readline()
        else:
            try:
                with _open_tty_input() as tty_in:
                    answer = tty_in.readline()
            except OSError as exc:
                raise RuntimeError(
                    "Cannot read confirmation from the controlling "
                    "terminal. Re-run with a TTY (e.g. in a normal shell) "
                    "or pass --file and keep stdin free for prompts.",
                ) from exc

    if answer == "":
        raise RuntimeError(
            "Confirmation input closed unexpectedly (EOF). "
            "Ensure the process has a controlling terminal.",
        )

    return answer.strip().lower() in {"y", "yes"}


def _write_conflict_report(
    stats: PopulateStats,
    *,
    dry_run: bool,
) -> Path:
    """Write ignored/conflict rows under ``backend/logs``."""

    _LOGS_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    mode = "dry-run" if dry_run else "inplace"
    report_path = _LOGS_DIR / f"user-populate-{mode}-{stamp}.json"
    report_path.write_text(
        json.dumps(stats.ignored_rows, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    return report_path


def _format_summary(
    stats: PopulateStats,
    *,
    dry_run: bool,
    report_path: Optional[Path],
) -> str:
    """Build the concise populate result line."""

    prefix = "[dry-run] " if dry_run else ""
    line = (
        f"{prefix}{stats.inserted} inserted, "
        f"{stats.updated} updated, "
        f"{stats.ignored} ignored"
    )

    if report_path is not None:
        line = f"{line} (more at {report_path})"

    return line


def _ignore(
    stats: PopulateStats,
    record: UserRecord,
    reason: str,
) -> None:
    """Record an ignored row and bump the counter."""

    stats.ignored += 1
    stats.ignored_rows.append(
        {
            "index": record.source_index,
            "username": record.username,
            "email": record.email,
            "reason": reason,
        },
    )


async def _populate(
    records: list[UserRecord],
    *,
    inplace: bool,
    assume_yes: bool,
    force: bool,
) -> PopulateStats:
    """Insert or update users from ``records`` according to flags."""

    stats = PopulateStats()
    dry_run = not inplace

    async with session_scope() as session:
        repository = UserRepository(session=session)

        for record in records:
            by_username = await repository.get_by_username(record.username)
            by_email = await repository.get_by_email(record.email)

            if by_username is not None and by_email is not None:
                if by_username.id != by_email.id:
                    _ignore(
                        stats,
                        record,
                        "username and email belong to different users",
                    )
                    continue

                existing = by_username
            elif by_username is not None:
                existing = by_username
            elif by_email is not None:
                existing = by_email
            else:
                existing = None

            if existing is None:
                await _handle_insert(
                    repository,
                    record,
                    stats=stats,
                    dry_run=dry_run,
                    assume_yes=assume_yes,
                )
                continue

            if not force:
                _ignore(
                    stats,
                    record,
                    (
                        f"conflict with existing user "
                        f"id={existing.id} username={existing.username!r} "
                        f"email={existing.email!r}"
                    ),
                )
                continue

            await _handle_update(
                repository,
                existing,
                record,
                stats=stats,
                dry_run=dry_run,
                assume_yes=assume_yes,
            )

    return stats


async def _handle_insert(
    repository: UserRepository,
    record: UserRecord,
    *,
    stats: PopulateStats,
    dry_run: bool,
    assume_yes: bool,
) -> None:
    """Insert a new user, or count a dry-run insert."""

    if dry_run:
        stats.inserted += 1

        return

    if not _confirm(
        f"Insert user {record.username!r} <{record.email}>?",
        assume_yes=assume_yes,
    ):
        _ignore(stats, record, "declined by user")

        return

    try:
        await repository.create_with_credential(
            username=record.username,
            email=record.email,
            password_hash=hash_password(record.password),
            password_algorithm=PASSWORD_ALGORITHM,
            display_name=record.display_name,
        )
    except IntegrityError:
        _ignore(stats, record, "integrity error on insert")

        return

    stats.inserted += 1


async def _handle_update(
    repository: UserRepository,
    existing: User,
    record: UserRecord,
    *,
    stats: PopulateStats,
    dry_run: bool,
    assume_yes: bool,
) -> None:
    """Update a conflicted user when ``--force`` is set."""

    if dry_run:
        stats.updated += 1

        return

    if not _confirm(
        (
            f"Update user id={existing.id} "
            f"({existing.username!r} / {existing.email!r}) "
            f"with {record.username!r} / {record.email!r}?"
        ),
        assume_yes=assume_yes,
    ):
        _ignore(stats, record, "declined by user")

        return

    try:
        await repository.update_with_credential(
            existing,
            username=record.username,
            email=record.email,
            password_hash=hash_password(record.password),
            password_algorithm=PASSWORD_ALGORITHM,
            display_name=record.display_name,
        )
    except IntegrityError:
        _ignore(stats, record, "integrity error on update")

        return

    stats.updated += 1


@app.command("generate")
def generate_command(
    user_count: Annotated[
        int,
        typer.Option(
            "--user-count",
            "-n",
            min=1,
            help="Number of users to generate.",
        ),
    ] = 10,
    output_format: Annotated[
        OutputFormat,
        typer.Option(
            "--format",
            "-f",
            help="Output format: csv, tsv, or json.",
            case_sensitive=False,
        ),
    ] = OutputFormat.CSV,
) -> None:
    """Generate random users with registration fields to stdout."""

    rows = generate_users(user_count)
    write_users(rows, output_format, sys.stdout)


@app.command("populate")
def populate_command(
    inplace: Annotated[
        bool,
        typer.Option(
            "--inplace",
            "-i",
            help="Write changes to the database (default is dry-run).",
        ),
    ] = False,
    assume_yes: Annotated[
        bool,
        typer.Option(
            "--yes",
            "-y",
            help="Skip confirmation prompts.",
        ),
    ] = False,
    force: Annotated[
        bool,
        typer.Option(
            "--force",
            "-f",
            help=(
                "Update existing users on username/email conflict "
                "instead of ignoring them."
            ),
        ),
    ] = False,
    file_path: Annotated[
        Optional[Path],
        typer.Option(
            "--file",
            help="Path to CSV, TSV, or JSON user list (else read stdin).",
            exists=True,
            dir_okay=False,
            readable=True,
            resolve_path=True,
        ),
    ] = None,
) -> None:
    """Insert users from stdin or ``--file`` into the database.

    Dry-run (default) counts would-be inserts/updates/ignores without
    prompts or writes. With ``--inplace``, each write is confirmed unless
    ``--yes`` is set. Conflicts are ignored (and logged under ``logs/``)
    unless ``--force`` is set, in which case matching rows are updated.
    """

    try:
        records = load_user_records(file_path=file_path)
    except OSError as exc:
        typer.echo(f"Error preparing input: {exc}", err=True)
        raise typer.Exit(code=1) from exc

    if not records:
        typer.echo("No user records to process.")
        raise typer.Exit(code=0)

    stats = run_async(
        _populate(
            records,
            inplace=inplace,
            assume_yes=assume_yes,
            force=force,
        ),
    )

    report_path: Optional[Path] = None

    if stats.ignored_rows:
        report_path = _write_conflict_report(
            stats,
            dry_run=not inplace,
        )

    typer.echo(
        _format_summary(
            stats,
            dry_run=not inplace,
            report_path=report_path,
        ),
    )
