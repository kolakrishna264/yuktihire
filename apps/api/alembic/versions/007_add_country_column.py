"""Add country column to jobs table

Revision ID: 007
Revises: 006
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if "jobs" in inspector.get_table_names():
        cols = [c["name"] for c in inspector.get_columns("jobs")]
        if "country" not in cols:
            op.add_column("jobs", sa.Column("country", sa.String(20), nullable=True))
            op.create_index("ix_jobs_country", "jobs", ["country"])


def downgrade() -> None:
    try:
        op.drop_index("ix_jobs_country", "jobs")
        op.drop_column("jobs", "country")
    except Exception:
        pass
