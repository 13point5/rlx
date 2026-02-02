"""Add job_logs and job_log_offsets tables

Revision ID: c3d4e5f6a7b8
Revises: beba02046458
Create Date: 2026-01-21 12:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "beba02046458"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create job_logs table
    op.create_table(
        "job_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("job_id", sa.Integer(), nullable=False),
        sa.Column("run_id", sa.Integer(), nullable=False),
        sa.Column("log_type", sa.String(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("byte_offset", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "captured_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.func.now()
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["run_id"], ["runs.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_job_logs_job_id", "job_logs", ["job_id"])
    op.create_index("ix_job_logs_run_id", "job_logs", ["run_id"])
    op.create_index("ix_job_logs_log_type", "job_logs", ["log_type"])

    # Create job_log_offsets table
    op.create_table(
        "job_log_offsets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("job_id", sa.Integer(), nullable=False),
        sa.Column("log_type", sa.String(), nullable=False),
        sa.Column("byte_offset", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.func.now()
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("job_id", "log_type", name="unique_job_log_type"),
    )
    op.create_index("ix_job_log_offsets_job_id", "job_log_offsets", ["job_id"])


def downgrade() -> None:
    op.drop_index("ix_job_log_offsets_job_id", table_name="job_log_offsets")
    op.drop_table("job_log_offsets")
    op.drop_index("ix_job_logs_log_type", table_name="job_logs")
    op.drop_index("ix_job_logs_run_id", table_name="job_logs")
    op.drop_index("ix_job_logs_job_id", table_name="job_logs")
    op.drop_table("job_logs")
