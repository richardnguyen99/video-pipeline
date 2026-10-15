"""Alembic environment (async SQLModel)."""

from __future__ import annotations

import asyncio
from logging.config import fileConfig
from typing import Any

from alembic import context
from alembic.operations import ops as alembic_ops
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config
from sqlalchemy.schema import ForeignKeyConstraint
from sqlmodel import SQLModel

from app.config import settings
import app.models  # noqa: F401 — register all models on metadata

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = SQLModel.metadata

db_url = settings.database_url
if db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
config.set_main_option("sqlalchemy.url", db_url)


def _local_column_names(constraint: ForeignKeyConstraint) -> tuple[str, ...]:
    """Return local column names without resolving remote tables."""

    names: list[str] = []

    for column in constraint.columns:
        name = getattr(column, "name", None)

        if isinstance(name, str) and name:
            names.append(name)
        else:
            names.append(str(column).split(".")[-1])

    return tuple(sorted(names))


def _remote_colspecs(
    constraint: ForeignKeyConstraint,
) -> tuple[tuple[str, str], ...]:
    """Return ``(table, column)`` pairs from FK colspecs without resolving tables.

    Accessing ``ForeignKey.column`` forces SQLAlchemy to resolve the target table
    and raises ``NoReferencedTableError`` when schema-qualified targets are not
    ready. Prefer the unresolved colspec string instead.
    """

    pairs: list[tuple[str, str]] = []

    for element in constraint.elements:
        colspec = getattr(element, "_colspec", None)

        if colspec is None:
            colspec = getattr(element, "target_fullname", None)

        if colspec is None:
            continue

        if isinstance(colspec, tuple):
            parts = [str(part) for part in colspec]
        else:
            parts = str(colspec).split(".")

        if len(parts) >= 2:
            pairs.append((parts[-2], parts[-1]))
        elif parts:
            pairs.append(("", parts[-1]))

    return tuple(sorted(pairs))


def _fk_signature(constraint: ForeignKeyConstraint) -> tuple[Any, ...]:
    """Normalize a foreign key so schema presentation does not affect equality."""

    return (
        constraint.name,
        _local_column_names(constraint),
        _remote_colspecs(constraint),
        (constraint.ondelete or "").upper() or None,
        (constraint.onupdate or "").upper() or None,
        constraint.deferrable,
        constraint.initially,
    )


def _fk_equivalent(
    left: ForeignKeyConstraint,
    right: ForeignKeyConstraint,
) -> bool:
    """Return True when two FKs are the same ignoring schema qualification."""

    return _fk_signature(left) == _fk_signature(right)


def include_name(
    name: str | None,
    type_: str,
    parent_names: dict[str, Any],
) -> bool:
    """Limit reflection to the application schema and skip Alembic internals."""

    if type_ == "schema":
        return name in (None, "public")

    return True


def include_object(
    object_: Any,
    name: str | None,
    type_: str,
    reflected: bool,
    compare_to: Any,
) -> bool:
    """Filter autogenerate noise from Alembic internals and equivalent FKs.

    With ``include_schemas=True``, PostgreSQL reflection also sees
    ``alembic_version``. That table is not in SQLModel metadata, so
    autogenerate would otherwise emit ``op.drop_table('alembic_version')``.

    Also skip false-positive FK diffs caused by schema qualification:
    reflection and metadata often disagree on whether ``public`` is part of
    the FK identity even when name, columns, and ON DELETE / ON UPDATE match.
    """

    if type_ == "table" and name == "alembic_version":
        return False

    if (
        type_ == "index"
        and name is not None
        and name.startswith(
            "alembic_version",
        )
    ):
        return False

    if type_ == "foreign_key_constraint" and compare_to is not None:
        if isinstance(object_, ForeignKeyConstraint) and isinstance(
            compare_to,
            ForeignKeyConstraint,
        ):
            if _fk_equivalent(object_, compare_to):
                return False

    return True


def _is_fk_drop(operation: Any) -> bool:
    """Return True for foreign-key drop operations."""

    return (
        isinstance(operation, alembic_ops.DropConstraintOp)
        and operation.constraint_type == "foreignkey"
    )


def _is_fk_create(operation: Any) -> bool:
    """Return True for foreign-key create operations."""

    return isinstance(operation, alembic_ops.CreateForeignKeyOp)


def _strip_noop_fk_pairs(operations: list[Any]) -> list[Any]:
    """Remove drop+create pairs that recreate the same foreign key."""

    creates_by_name: dict[str | None, list[Any]] = {}

    for operation in operations:
        if _is_fk_create(operation):
            creates_by_name.setdefault(operation.constraint_name, []).append(
                operation,
            )

    skip_ids: set[int] = set()

    for operation in operations:
        if not _is_fk_drop(operation):
            continue

        candidates = creates_by_name.get(operation.constraint_name, [])

        for create in candidates:
            if id(create) in skip_ids:
                continue

            same_table = (
                operation.table_name == create.source_table
                or operation.table_name == create.referent_table
            )

            if not same_table:
                continue

            local = tuple(create.local_cols or ())
            drop_cols = tuple(operation.columns or ())

            if drop_cols and local and drop_cols != local:
                continue

            skip_ids.add(id(operation))
            skip_ids.add(id(create))
            break

    cleaned: list[Any] = []

    for operation in operations:
        if id(operation) in skip_ids:
            continue

        if isinstance(operation, alembic_ops.ModifyTableOps):
            inner = _strip_noop_fk_pairs(list(operation.ops))

            if not inner:
                continue

            operation.ops = inner
            cleaned.append(operation)

            continue

        cleaned.append(operation)

    return cleaned


def process_revision_directives(
    context_: Any,
    revision: Any,
    directives: list[Any],
) -> None:
    """Drop no-op FK churn from autogenerated revisions."""

    if not getattr(config.cmd_opts, "autogenerate", False):
        return

    if not directives:
        return

    script = directives[0]

    if script.upgrade_ops is not None:
        script.upgrade_ops.ops = _strip_noop_fk_pairs(
            list(script.upgrade_ops.ops),
        )

    if script.downgrade_ops is not None:
        script.downgrade_ops.ops = _strip_noop_fk_pairs(
            list(script.downgrade_ops.ops),
        )


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""

    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_schemas=True,
        include_name=include_name,
        include_object=include_object,
        process_revision_directives=process_revision_directives,
        version_table_schema="public",
        version_table="alembic_version",
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    """Run migrations given a sync connection."""

    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        include_schemas=True,
        include_name=include_name,
        include_object=include_object,
        process_revision_directives=process_revision_directives,
        version_table_schema="public",
        version_table="alembic_version",
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Create an async engine and run migrations."""

    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""

    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
