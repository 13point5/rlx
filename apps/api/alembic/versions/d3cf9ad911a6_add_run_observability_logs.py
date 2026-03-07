"""add run observability logs

Revision ID: d3cf9ad911a6
Revises: beba02046458
Create Date: 2026-03-07 01:22:46.883936

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "d3cf9ad911a6"
down_revision: Union[str, None] = "beba02046458"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("runs", sa.Column("monitoring", sa.JSON(), nullable=True))

    op.create_table(
        "run_log_streams",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("run_id", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(), nullable=False),
        sa.Column("display_name", sa.String(), nullable=False),
        sa.Column("remote_path", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("last_remote_offset", sa.BigInteger(), nullable=False),
        sa.Column("last_chunk_sequence", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["run_id"], ["runs.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("run_id", "source", name="unique_run_log_source"),
    )
    op.create_index(
        op.f("ix_run_log_streams_run_id"),
        "run_log_streams",
        ["run_id"],
        unique=False,
    )

    op.create_table(
        "run_log_chunks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("stream_id", sa.Integer(), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("start_offset", sa.BigInteger(), nullable=False),
        sa.Column("end_offset", sa.BigInteger(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["stream_id"], ["run_log_streams.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("stream_id", "sequence", name="unique_run_log_chunk"),
    )
    op.create_index(
        op.f("ix_run_log_chunks_stream_id"),
        "run_log_chunks",
        ["stream_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_run_log_chunks_stream_id"), table_name="run_log_chunks")
    op.drop_table("run_log_chunks")
    op.drop_index(op.f("ix_run_log_streams_run_id"), table_name="run_log_streams")
    op.drop_table("run_log_streams")
    op.drop_column("runs", "monitoring")
