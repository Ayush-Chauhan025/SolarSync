from datetime import date, datetime
from uuid import UUID as PyUUID, uuid4

from sqlalchemy import ( CheckConstraint, Date, DateTime, ForeignKey, Integer, String, UniqueConstraint, func)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"

    id: Mapped[PyUUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True)
    display_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Home(Base):
    __tablename__ = "homes"

    id: Mapped[PyUUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[PyUUID] = mapped_column( PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    settings: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column( DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column( DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class TaskPreset(Base):
    __tablename__ = "task_presets"
    __table_args__ = (UniqueConstraint("home_id", "name", name="uq_task_preset_home_name"),)

    id: Mapped[PyUUID] = mapped_column( PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    home_id: Mapped[PyUUID] = mapped_column( PGUUID(as_uuid=True), ForeignKey("homes.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    
    task_data: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column( DateTime(timezone=True), server_default=func.now(), nullable=False)


class DailySchedule(Base):
    __tablename__ = "schedules"
    __table_args__ = (
        UniqueConstraint("home_id", "schedule_date", name="uq_schedule_home_date"),
        CheckConstraint("revision >= 1", name="ck_schedule_revision_positive"),
    )

    id: Mapped[PyUUID] = mapped_column( PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    home_id: Mapped[PyUUID] = mapped_column( PGUUID(as_uuid=True), ForeignKey("homes.id", ondelete="CASCADE"), nullable=False, index=True)
    schedule_date: Mapped[date] = mapped_column(Date, nullable=False)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    solver_outcome: Mapped[str] = mapped_column(String(20), nullable=False)

    schedule_data: Mapped[dict] = mapped_column(JSONB, nullable=False)
    request_data: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column( DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[PyUUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    home_id: Mapped[PyUUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("homes.id", ondelete="CASCADE"), nullable=False, index=True)
    schedule_id: Mapped[PyUUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("schedules.id", ondelete="CASCADE"), nullable=False, index=True)
    task_id: Mapped[PyUUID | None] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    kind: Mapped[str] = mapped_column(String(30), nullable=False)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    message: Mapped[str] = mapped_column(String(300), nullable=False)
    notify_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
