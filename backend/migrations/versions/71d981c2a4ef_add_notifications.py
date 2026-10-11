"""add notifications

Revision ID: 71d981c2a4ef
Revises: 8c3c5f6f8b3a
Create Date: 2026-10-11

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "71d981c2a4ef"
down_revision: Union[str, Sequence[str], None] = "8c3c5f6f8b3a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("home_id", sa.UUID(), nullable=False),
        sa.Column("schedule_id", sa.UUID(), nullable=False),
        sa.Column("task_id", sa.UUID(), nullable=True),
        sa.Column("kind", sa.String(length=30), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("message", sa.String(length=300), nullable=False),
        sa.Column("notify_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["home_id"], ["homes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["schedule_id"], ["schedules.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_notifications_home_id", "notifications", ["home_id"], unique=False)
    op.create_index("ix_notifications_schedule_id", "notifications", ["schedule_id"], unique=False)
    op.create_index("ix_notifications_notify_at", "notifications", ["notify_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_notifications_notify_at", table_name="notifications")
    op.drop_index("ix_notifications_schedule_id", table_name="notifications")
    op.drop_index("ix_notifications_home_id", table_name="notifications")
    op.drop_table("notifications")
