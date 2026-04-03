"""V4: No schema changes — production hardening

Revision ID: 005
Revises: 004
Create Date: 2026-04-03
"""
from typing import Sequence, Union
from alembic import op

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # V4 has no schema changes — all tables and columns exist from prior migrations
    pass

def downgrade() -> None:
    pass
