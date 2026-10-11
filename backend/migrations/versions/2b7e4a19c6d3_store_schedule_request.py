"""store schedule request snapshot

Revision ID: 2b7e4a19c6d3
Revises: 71d981c2a4ef
Create Date: 2026-10-11

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "2b7e4a19c6d3"
down_revision: Union[str, Sequence[str], None] = "71d981c2a4ef"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "schedules",
        sa.Column(
            "request_data",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
    )
    op.alter_column("schedules", "request_data", server_default=None)


def downgrade() -> None:
    op.drop_column("schedules", "request_data")
