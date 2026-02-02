"""Add prime-rl metrics logging tables

Revision ID: 001_metrics
Revises:
Create Date: 2026-02-02

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

# revision identifiers, used by Alembic.
revision: str = "001_metrics"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create run_metrics table
    op.create_table(
        "run_metrics",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("run_id", sa.Integer(), nullable=False),
        sa.Column("step", sa.Integer(), nullable=True),
        sa.Column("metrics", JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["run_id"],
            ["runs.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_run_metrics_run_id", "run_metrics", ["run_id"])
    op.create_index("ix_run_metrics_run_step", "run_metrics", ["run_id", "step"])

    # Create run_samples table
    op.create_table(
        "run_samples",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("run_id", sa.Integer(), nullable=False),
        sa.Column("step", sa.Integer(), nullable=False),
        sa.Column("example_id", sa.String(), nullable=True),
        sa.Column("prompt", JSON(), nullable=True),
        sa.Column("completion", JSON(), nullable=True),
        sa.Column("trajectory", JSON(), nullable=True),
        sa.Column("reward", sa.Float(), nullable=True),
        sa.Column("advantage", sa.Float(), nullable=True),
        sa.Column("answer", sa.Text(), nullable=True),
        sa.Column("task", sa.String(), nullable=True),
        sa.Column("info", JSON(), nullable=True),
        sa.Column("sample_metrics", JSON(), nullable=True),
        sa.Column("timing", JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["run_id"],
            ["runs.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_run_samples_run_id", "run_samples", ["run_id"])
    op.create_index("ix_run_samples_run_step", "run_samples", ["run_id", "step"])

    # Create run_distributions table
    op.create_table(
        "run_distributions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("run_id", sa.Integer(), nullable=False),
        sa.Column("step", sa.Integer(), nullable=False),
        sa.Column("distributions", JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["run_id"],
            ["runs.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_run_distributions_run_id", "run_distributions", ["run_id"])
    op.create_index("ix_run_distributions_run_step", "run_distributions", ["run_id", "step"])

    # Create run_summaries table
    op.create_table(
        "run_summaries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("run_id", sa.Integer(), nullable=False),
        sa.Column("summary", JSON(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finalized_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["run_id"],
            ["runs.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("run_id"),
    )


def downgrade() -> None:
    op.drop_table("run_summaries")
    op.drop_index("ix_run_distributions_run_step", table_name="run_distributions")
    op.drop_index("ix_run_distributions_run_id", table_name="run_distributions")
    op.drop_table("run_distributions")
    op.drop_index("ix_run_samples_run_step", table_name="run_samples")
    op.drop_index("ix_run_samples_run_id", table_name="run_samples")
    op.drop_table("run_samples")
    op.drop_index("ix_run_metrics_run_step", table_name="run_metrics")
    op.drop_index("ix_run_metrics_run_id", table_name="run_metrics")
    op.drop_table("run_metrics")
