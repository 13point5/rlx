"""replace config paths with config_name

Revision ID: beba02046458
Revises: 04daca96877c
Create Date: 2026-01-20 23:17:44.698378

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "beba02046458"
down_revision: Union[str, None] = "04daca96877c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add config_name column (nullable initially for existing rows)
    op.add_column("runs", sa.Column("config_name", sa.String(), nullable=True))

    # Migrate existing data: use config_path value or 'default' as config_name
    op.execute(
        "UPDATE runs SET config_name = COALESCE(config_path, 'default') WHERE config_name IS NULL"
    )

    # Make config_name non-nullable
    op.alter_column("runs", "config_name", nullable=False)

    # Drop old columns
    op.drop_column("runs", "inference_config")
    op.drop_column("runs", "trainer_config")
    op.drop_column("runs", "orchestrator_config")
    op.drop_column("runs", "config_path")


def downgrade() -> None:
    # Re-add old columns
    op.add_column(
        "runs", sa.Column("config_path", sa.VARCHAR(), autoincrement=False, nullable=True)
    )
    op.add_column(
        "runs", sa.Column("orchestrator_config", sa.VARCHAR(), autoincrement=False, nullable=True)
    )
    op.add_column(
        "runs", sa.Column("trainer_config", sa.VARCHAR(), autoincrement=False, nullable=True)
    )
    op.add_column(
        "runs", sa.Column("inference_config", sa.VARCHAR(), autoincrement=False, nullable=True)
    )

    # Migrate config_name back to config_path
    op.execute("UPDATE runs SET config_path = config_name")

    # Drop config_name
    op.drop_column("runs", "config_name")
