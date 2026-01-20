"""Add pod_ip and pod_ssh_port columns to runs table

Revision ID: b2c3d4e5f6g7
Revises: a1b2c3d4e5f6
Create Date: 2026-01-20 12:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b2c3d4e5f6g7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("runs", sa.Column("pod_ip", sa.String(), nullable=True))
    op.add_column("runs", sa.Column("pod_ssh_port", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("runs", "pod_ssh_port")
    op.drop_column("runs", "pod_ip")
