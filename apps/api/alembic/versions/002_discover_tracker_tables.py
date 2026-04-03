"""Add discover and tracker tables, extend job_applications

Revision ID: 002
Revises: 001
Create Date: 2026-04-02
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
import uuid

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    # --- Create jobs table (discover) ---
    if "jobs" not in existing_tables:
        op.create_table(
            "jobs",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("fingerprint", sa.String(64), unique=True, index=True, nullable=False),
            sa.Column("title", sa.String(500), nullable=False),
            sa.Column("company", sa.String(255), nullable=False),
            sa.Column("company_normalized", sa.String(255), index=True),
            sa.Column("location", sa.String(255)),
            sa.Column("url", sa.String(1000)),
            sa.Column("description_text", sa.Text()),
            sa.Column("salary_min", sa.Integer()),
            sa.Column("salary_max", sa.Integer()),
            sa.Column("salary_raw", sa.String(200)),
            sa.Column("work_type", sa.String(20)),
            sa.Column("employment_type", sa.String(30)),
            sa.Column("experience_level", sa.String(50)),
            sa.Column("industry", sa.String(100)),
            sa.Column("posted_at", sa.DateTime(timezone=True)),
            sa.Column("is_active", sa.Boolean(), default=True, index=True),
            sa.Column("company_logo_url", sa.String(500)),
            sa.Column("metadata", sa.JSON(), default=dict),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )

    # --- Create job_sources table ---
    if "job_sources" not in existing_tables:
        op.create_table(
            "job_sources",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("slug", sa.String(50), unique=True, nullable=False),
            sa.Column("name", sa.String(100), nullable=False),
            sa.Column("is_active", sa.Boolean(), default=True),
            sa.Column("config", sa.JSON(), default=dict),
            sa.Column("last_sync_at", sa.DateTime(timezone=True)),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )

    # --- Create job_source_links table ---
    if "job_source_links" not in existing_tables:
        op.create_table(
            "job_source_links",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("job_id", sa.String(), sa.ForeignKey("jobs.id"), index=True, nullable=False),
            sa.Column("source_id", sa.String(), sa.ForeignKey("job_sources.id"), index=True, nullable=False),
            sa.Column("external_id", sa.String(200), nullable=False),
            sa.Column("source_url", sa.String(1000)),
            sa.Column("raw_data", sa.JSON()),
            sa.Column("first_seen_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.UniqueConstraint("source_id", "external_id", name="uq_source_external"),
        )

    # --- Create job_skills table ---
    if "job_skills" not in existing_tables:
        op.create_table(
            "job_skills",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("job_id", sa.String(), sa.ForeignKey("jobs.id", ondelete="CASCADE"), index=True, nullable=False),
            sa.Column("skill_name", sa.String(100), nullable=False),
            sa.Column("skill_canonical", sa.String(100), index=True),
            sa.Column("is_required", sa.Boolean(), default=True),
        )

    # --- Create application_events table ---
    if "application_events" not in existing_tables:
        op.create_table(
            "application_events",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("application_id", sa.String(), sa.ForeignKey("job_applications.id", ondelete="CASCADE"), index=True, nullable=False),
            sa.Column("event_type", sa.String(50), nullable=False),
            sa.Column("old_value", sa.String(100)),
            sa.Column("new_value", sa.String(100)),
            sa.Column("title", sa.String(255)),
            sa.Column("description", sa.Text()),
            sa.Column("metadata_json", sa.JSON(), default=dict),
            sa.Column("event_date", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )

    # --- Add new columns to job_applications ---
    existing_cols = [c["name"] for c in inspector.get_columns("job_applications")]

    pipeline_stage_enum = sa.Enum(
        "INTERESTED", "SHORTLISTED", "RESUME_TAILORED", "READY_TO_APPLY",
        "APPLIED", "PHONE_SCREEN", "INTERVIEWING", "OFFER",
        "REJECTED", "WITHDRAWN", "ARCHIVED",
        name="pipelinestage",
    )

    new_cols = {
        "job_id": sa.Column("job_id", sa.String(), sa.ForeignKey("jobs.id"), index=True),
        "pipeline_stage": sa.Column("pipeline_stage", pipeline_stage_enum, default="INTERESTED", index=True),
        "priority": sa.Column("priority", sa.Integer(), server_default="0"),
        "resume_version_id": sa.Column("resume_version_id", sa.String(), sa.ForeignKey("resume_versions.id")),
        "next_action_date": sa.Column("next_action_date", sa.DateTime(timezone=True)),
        "archived": sa.Column("archived", sa.Boolean(), server_default="false"),
    }

    for col_name, col_def in new_cols.items():
        if col_name not in existing_cols:
            op.add_column("job_applications", col_def)

    # --- Seed job_sources ---
    job_sources = sa.table(
        "job_sources",
        sa.column("id", sa.String),
        sa.column("slug", sa.String),
        sa.column("name", sa.String),
        sa.column("is_active", sa.Boolean),
    )

    # Check if already seeded
    result = conn.execute(sa.text("SELECT COUNT(*) FROM job_sources"))
    count = result.scalar()
    if count == 0:
        op.bulk_insert(job_sources, [
            {"id": str(uuid.uuid4()), "slug": "remotive", "name": "Remotive", "is_active": True},
            {"id": str(uuid.uuid4()), "slug": "arbeitnow", "name": "Arbeitnow", "is_active": True},
            {"id": str(uuid.uuid4()), "slug": "manual", "name": "Manual Entry", "is_active": True},
        ])


def downgrade() -> None:
    # Drop new columns from job_applications
    op.drop_column("job_applications", "archived")
    op.drop_column("job_applications", "next_action_date")
    op.drop_column("job_applications", "resume_version_id")
    op.drop_column("job_applications", "priority")
    op.drop_column("job_applications", "pipeline_stage")
    op.drop_column("job_applications", "job_id")

    # Drop tables in reverse dependency order
    op.drop_table("application_events")
    op.drop_table("job_skills")
    op.drop_table("job_source_links")
    op.drop_table("job_sources")
    op.drop_table("jobs")

    # Drop the enum type
    sa.Enum(name="pipelinestage").drop(op.get_bind(), checkfirst=True)
