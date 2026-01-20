"""replace pod connection columns with ssh_connection

Revision ID: 044af1a8eba9
Revises: b2c3d4e5f6g7
Create Date: 2026-01-20 02:10:01.955049

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '044af1a8eba9'
down_revision: Union[str, None] = 'b2c3d4e5f6g7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('runs', sa.Column('ssh_connection', sa.String(), nullable=True))
    op.drop_column('runs', 'pod_ip')
    op.drop_column('runs', 'pod_ssh_port')


def downgrade() -> None:
    op.add_column('runs', sa.Column('pod_ssh_port', sa.INTEGER(), autoincrement=False, nullable=True))
    op.add_column('runs', sa.Column('pod_ip', sa.VARCHAR(), autoincrement=False, nullable=True))
    op.drop_column('runs', 'ssh_connection')
