"""Alembic environment configuration."""

import asyncio
import os
from logging.config import fileConfig

from alembic import context
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel import SQLModel

load_dotenv()  # reads .env in the project root if present

# Import all models so Alembic can detect them
import app.models  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = SQLModel.metadata


def include_object(object, name, type_, reflected, compare_to):

    if type_ == "table":
        return object.schema == "app_user_schema"
    if type_ == "column":
        return object.table.schema == "app_user_schema"
    return True


def get_url() -> str:
    """Return the async-compatible database URL."""
    url = os.environ.get(
        "DATABASE_URL", config.get_main_option("sqlalchemy.url")
    )
    return url.replace("postgresql://", "postgresql+asyncpg://").replace(
        "postgres://", "postgresql+asyncpg://"
    )


def run_migrations_offline() -> None:
    """Run migrations in offline mode (no live DB connection needed)."""
    context.configure(
        url=get_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        version_table="video_pipeline_migration_history",
        version_table_schema="app_user_schema",
        include_schemas=True,
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    """Execute migrations within the given connection."""
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        version_table="video_pipeline_migration_history",
        version_table_schema="app_user_schema",
        include_schemas=True,
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Run migrations in online mode using an async engine."""
    connectable = create_async_engine(get_url())
    print(f"Running migrations online with URL: {get_url()}")
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
