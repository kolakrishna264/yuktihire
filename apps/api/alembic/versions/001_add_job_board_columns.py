"""Add job board metadata columns to job_applications

Revision ID: 001
Revises: None
Create Date: 2026-04-03
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # These columns may already exist from create_all — use batch mode to be safe
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing = [c["name"] for c in inspector.get_columns("job_applications")]

    cols_to_add = {
        "work_type": sa.Column("work_type", sa.String(50), nullable=True),
        "experience_level": sa.Column("experience_level", sa.String(50), nullable=True),
        "industry": sa.Column("industry", sa.String(100), nullable=True),
        "skills_json": sa.Column("skills_json", sa.Text(), nullable=True),
        "description": sa.Column("description", sa.Text(), nullable=True),
        "external_job_id": sa.Column("external_job_id", sa.String(100), nullable=True),
        "posted_at": sa.Column("posted_at", sa.String(50), nullable=True),
    }

    for col_name, col_def in cols_to_add.items():
        if col_name not in existing:
            op.add_column("job_applications", col_def)


def downgrade() -> None:
    op.drop_column("job_applications", "posted_at")
    op.drop_column("job_applications", "external_job_id")
    op.drop_column("job_applications", "description")
    op.drop_column("job_applications", "skills_json")
    op.drop_column("job_applications", "industry")
    op.drop_column("job_applications", "experience_level")
    op.drop_column("job_applications", "work_type")
