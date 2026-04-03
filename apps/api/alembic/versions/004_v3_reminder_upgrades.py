"""Add reminder_type, snoozed_until, is_overdue to reminders table

Revision ID: 004
Revises: 003
Create Date: 2026-04-02
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_columns = [c["name"] for c in inspector.get_columns("reminders")]

    if "reminder_type" not in existing_columns:
        op.add_column("reminders", sa.Column("reminder_type", sa.String(50), nullable=True))

    if "snoozed_until" not in existing_columns:
        op.add_column("reminders", sa.Column("snoozed_until", sa.DateTime(timezone=True), nullable=True))

    if "is_overdue" not in existing_columns:
        op.add_column("reminders", sa.Column("is_overdue", sa.Boolean(), server_default=sa.text("false"), nullable=False))


def downgrade() -> None:
    op.drop_column("reminders", "is_overdue")
    op.drop_column("reminders", "snoozed_until")
    op.drop_column("reminders", "reminder_type")
