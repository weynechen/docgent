"""Add notebook sources metadata table.

Revision ID: 20260315_sources
Revises: 20260314_notebooks
Create Date: 2026-03-15 09:50:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260315_sources"
down_revision: str | None = "20260314_notebooks"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    """Create notebook source metadata table."""

    op.create_table(
        "notebook_sources",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("notebook_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("type", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("source_url", sa.String(length=2048), nullable=True),
        sa.Column("mime_type", sa.String(length=255), nullable=True),
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
            name=op.f("notebook_sources_notebook_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("notebook_sources_pkey")),
    )
    op.create_index(
        op.f("notebook_sources_notebook_id_idx"),
        "notebook_sources",
        ["notebook_id"],
        unique=False,
    )


def downgrade() -> None:
    """Drop notebook source metadata table."""

    op.drop_index(op.f("notebook_sources_notebook_id_idx"), table_name="notebook_sources")
    op.drop_table("notebook_sources")
