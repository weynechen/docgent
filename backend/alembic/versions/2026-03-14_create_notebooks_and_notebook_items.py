"""Create notebook persistence tables.

Revision ID: 2026-03-14_create_notebooks_and_notebook_items
Revises: 20260313_initial_schema
Create Date: 2026-03-14 23:50:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "2026-03-14_create_notebooks_and_notebook_items"
down_revision: str | None = "20260313_initial_schema"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    """Create notebook tables."""

    op.create_table(
        "notebooks",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("notebooks_pkey")),
    )

    op.create_table(
        "notebook_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("notebook_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("type", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("content_format", sa.String(length=32), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False),
        sa.Column("server_revision", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["notebook_id"],
            ["notebooks.id"],
            name=op.f("notebook_items_notebook_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("notebook_items_pkey")),
    )
    op.create_index(
        op.f("notebook_items_notebook_id_idx"),
        "notebook_items",
        ["notebook_id"],
        unique=False,
    )


def downgrade() -> None:
    """Drop notebook tables."""

    op.drop_index(op.f("notebook_items_notebook_id_idx"), table_name="notebook_items")
    op.drop_table("notebook_items")
    op.drop_table("notebooks")
