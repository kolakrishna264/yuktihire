"""Add contacts, reminders, and user_preferences tables

Revision ID: 003
Revises: 002
Create Date: 2026-04-02
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    # --- Create contacts table ---
    if "contacts" not in existing_tables:
        op.create_table(
            "contacts",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("user_id", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False),
            sa.Column("application_id", sa.String(), sa.ForeignKey("job_applications.id", ondelete="SET NULL"), index=True),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("role", sa.String(100)),
            sa.Column("email", sa.String(255)),
            sa.Column("phone", sa.String(50)),
            sa.Column("linkedin_url", sa.String(500)),
            sa.Column("company", sa.String(255)),
            sa.Column("notes", sa.Text()),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )

    # --- Create reminders table ---
    if "reminders" not in existing_tables:
        op.create_table(
            "reminders",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("user_id", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False),
            sa.Column("application_id", sa.String(), sa.ForeignKey("job_applications.id", ondelete="CASCADE"), index=True),
            sa.Column("title", sa.String(255), nullable=False),
            sa.Column("description", sa.Text()),
            sa.Column("remind_at", sa.DateTime(timezone=True), nullable=False, index=True),
            sa.Column("is_completed", sa.Boolean(), default=False),
            sa.Column("completed_at", sa.DateTime(timezone=True)),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )

    # --- Create user_preferences table ---
    if "user_preferences" not in existing_tables:
        op.create_table(
            "user_preferences",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("user_id", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False),
            sa.Column("preferred_titles", sa.Text()),
            sa.Column("preferred_locations", sa.Text()),
            sa.Column("preferred_work_types", sa.Text()),
            sa.Column("preferred_industries", sa.Text()),
            sa.Column("preferred_skills", sa.Text()),
            sa.Column("min_salary", sa.Integer()),
            sa.Column("max_salary", sa.Integer()),
            sa.Column("experience_level", sa.String(50)),
            sa.Column("visa_sponsorship", sa.Boolean()),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )


def downgrade() -> None:
    op.drop_table("user_preferences")
    op.drop_table("reminders")
    op.drop_table("contacts")
