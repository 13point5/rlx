"""remove unique constraint from user_ssh_keys to allow multiple keys per user

Revision ID: 162f4b1482d4
Revises: 60ccf1193e7a
Create Date: 2026-01-18 22:30:31.801198

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "162f4b1482d4"
down_revision: Union[str, None] = "60ccf1193e7a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop unique constraint on user_ssh_keys to allow multiple keys per user
    op.drop_constraint("unique_user_ssh_key", "user_ssh_keys", type_="unique")


def downgrade() -> None:
    # Restore unique constraint on user_ssh_keys
    op.create_unique_constraint(
        "unique_user_ssh_key",
        "user_ssh_keys",
        ["clerk_user_id"],
        postgresql_nulls_not_distinct=False,
    )
