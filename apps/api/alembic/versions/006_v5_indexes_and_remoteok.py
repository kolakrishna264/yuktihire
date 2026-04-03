"""V5: Add performance indexes and RemoteOK source

Revision ID: 006
Revises: 005
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    # Add indexes for search performance on jobs table
    existing_indexes = {idx["name"] for idx in inspector.get_indexes("jobs")} if "jobs" in inspector.get_table_names() else set()

    if "ix_jobs_posted_active" not in existing_indexes:
        try:
            op.create_index("ix_jobs_posted_active", "jobs", ["is_active", "posted_at"], unique=False)
        except Exception:
            pass

    # Add composite index on job_applications for pipeline queries
    app_indexes = {idx["name"] for idx in inspector.get_indexes("job_applications")} if "job_applications" in inspector.get_table_names() else set()

    if "ix_job_applications_pipeline" not in app_indexes:
        try:
            op.create_index("ix_job_applications_pipeline", "job_applications", ["user_id", "pipeline_stage", "archived"], unique=False)
        except Exception:
            pass

    # Seed RemoteOK source if not exists
    try:
        op.execute(
            sa.text("""
                INSERT INTO job_sources (id, slug, name, is_active, config)
                SELECT gen_random_uuid()::text, 'remoteok', 'RemoteOK', true, '{}'::json
                WHERE NOT EXISTS (SELECT 1 FROM job_sources WHERE slug = 'remoteok')
            """)
        )
    except Exception:
        pass


def downgrade() -> None:
    try:
        op.drop_index("ix_job_applications_pipeline", "job_applications")
    except Exception:
        pass
    try:
        op.drop_index("ix_jobs_posted_active", "jobs")
    except Exception:
        pass
