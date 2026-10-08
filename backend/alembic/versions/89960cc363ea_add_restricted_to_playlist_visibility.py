"""Add restricted to playlist_visibility enum.

Revision ID: 89960cc363ea
Revises: 9a5b9296df8b
Create Date: 2026-10-08 12:32:28.789349

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "89960cc363ea"
down_revision: Union[str, Sequence[str], None] = "9a5b9296df8b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ALTER TYPE ... ADD VALUE may fail in transaction blocks on older Postgres.
    with op.get_context().autocommit_block():
        op.execute(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_enum e
                    JOIN pg_type t ON t.oid = e.enumtypid
                    JOIN pg_namespace n ON n.oid = t.typnamespace
                    WHERE t.typname = 'playlist_visibility'
                      AND n.nspname = 'public'
                      AND e.enumlabel = 'restricted'
                ) THEN
                    ALTER TYPE public.playlist_visibility
                    ADD VALUE 'restricted';
                END IF;
            END
            $$;
            """,
        )


def downgrade() -> None:
    # PostgreSQL does not support removing a single enum label safely.
    pass
