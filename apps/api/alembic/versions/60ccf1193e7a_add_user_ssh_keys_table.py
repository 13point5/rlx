"""add user ssh keys table

Revision ID: 60ccf1193e7a
Revises: d911530da9f8
Create Date: 2026-01-15 12:34:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "60ccf1193e7a"
down_revision: Union[str, None] = "d911530da9f8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_ssh_keys",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("clerk_user_id", sa.String(), nullable=False),
        sa.Column("public_key", sa.String(), nullable=False),
        sa.Column("prime_ssh_key_id", sa.String(), nullable=False),
        sa.Column("aws_secret_arn", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("clerk_user_id", name="unique_user_ssh_key"),
    )
    op.create_index(
        op.f("ix_user_ssh_keys_clerk_user_id"),
        "user_ssh_keys",
        ["clerk_user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_user_ssh_keys_clerk_user_id"), table_name="user_ssh_keys")
    op.drop_table("user_ssh_keys")
