"""add separate config columns to runs

Revision ID: 04daca96877c
Revises: 044af1a8eba9
Create Date: 2026-01-20 22:49:35.718368

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '04daca96877c'
down_revision: Union[str, None] = '044af1a8eba9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('runs', sa.Column('inference_config', sa.String(), nullable=True))
    op.add_column('runs', sa.Column('orchestrator_config', sa.String(), nullable=True))
    op.add_column('runs', sa.Column('trainer_config', sa.String(), nullable=True))
    op.alter_column('runs', 'config_path',
               existing_type=sa.VARCHAR(),
               nullable=True)


def downgrade() -> None:
    op.alter_column('runs', 'config_path',
               existing_type=sa.VARCHAR(),
               nullable=False)
    op.drop_column('runs', 'trainer_config')
    op.drop_column('runs', 'orchestrator_config')
    op.drop_column('runs', 'inference_config')
