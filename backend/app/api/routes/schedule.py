from datetime import date, datetime, time, timedelta, timezone
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.database import get_db
from app.schemas import EnergySummary, HomeEnergy, NotificationResponse, ScheduleChange, SchedulePreviewResponse, ScheduleRequest, ScheduleResponse
from app.services.scheduler import evaluate_day_energy, solve_schedule
from app.services.solar_forecast import SolarForecastUnavailable, fetch_solar_forecast
from models import DailySchedule, Home, Notification

router = APIRouter()


async def build_preview(body: ScheduleRequest, db: Session, user_id: UUID) -> SchedulePreviewResponse:
    home = db.scalar(select(Home).where(Home.id == body.home_id, Home.user_id == user_id))
    if home is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Home profile not found")

    settings = HomeEnergy.model_validate(home.settings)
    db.rollback()
    try:
        forecast = await fetch_solar_forecast(settings, body.schedule_date)
    except SolarForecastUnavailable as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    result = solve_schedule(settings, forecast.solar_generation_kw, body.tasks, body.optimization_goal)
    energy_summary = None
    if result.day_energy is not None:
        baseline_energy = evaluate_day_energy(settings, forecast.solar_generation_kw, [0.0] * 1440)
        energy_summary = EnergySummary(
            grid_import_before_kwh=baseline_energy.grid_import_kwh,
            grid_import_after_kwh=result.day_energy.grid_import_kwh,
            solar_used_before_kwh=baseline_energy.solar_used_kwh,
            solar_used_after_kwh=result.day_energy.solar_used_kwh,
            grid_export_after_kwh=result.day_energy.grid_export_kwh,
            estimated_cost_before_inr=baseline_energy.energy_cost_inr,
            estimated_cost_after_inr=result.day_energy.energy_cost_inr
        )

    return SchedulePreviewResponse(
        schedule_date=body.schedule_date,
        solver_outcome=result.solver_outcome,
        scheduled_tasks=result.scheduled_tasks,
        unscheduled_tasks=result.unscheduled_tasks,
        energy_summary=energy_summary
    )


def build_changes(previous_data: dict | None, preview: SchedulePreviewResponse) -> list[ScheduleChange]:
    previous_data = previous_data or {}
    previous_scheduled = {item["task_id"]: item for item in previous_data.get("scheduled_tasks", [])}
    previous_unscheduled = {item["task_id"]: item for item in previous_data.get("unscheduled_tasks", [])}
    current_scheduled = {str(item.task_id): item for item in preview.scheduled_tasks}
    current_unscheduled = {str(item.task_id): item for item in preview.unscheduled_tasks}
    changes = []

    for task_id, current in current_scheduled.items():
        previous = previous_scheduled.get(task_id)
        new_segments = [segment.model_dump(mode="json") for segment in current.segments]
        if previous is None:
            changes.append(ScheduleChange(task_id=task_id, change_type="added", new_segments=current.segments, reason="Task was added to the schedule"))
        elif previous.get("segments") != new_segments:
            changes.append(ScheduleChange(task_id=task_id, change_type="moved", previous_segments=previous.get("segments"), new_segments=current.segments, reason="Task run time changed"))

    previous_ids = set(previous_scheduled) | set(previous_unscheduled)
    current_ids = set(current_scheduled) | set(current_unscheduled)
    for task_id, current in current_unscheduled.items():
        if task_id in previous_scheduled or task_id not in previous_ids:
            changes.append(ScheduleChange(task_id=task_id, change_type="unscheduled", previous_segments=previous_scheduled.get(task_id, {}).get("segments"), reason=current.reason))

    for task_id in sorted(previous_ids - current_ids):
        previous = previous_scheduled.get(task_id, {})
        changes.append(ScheduleChange(task_id=task_id, change_type="removed", previous_segments=previous.get("segments"), reason="Task was removed from the new request"))

    return changes


@router.post("/schedules/preview", response_model=SchedulePreviewResponse)
async def preview_schedule(body: ScheduleRequest, db: Session = Depends(get_db), user_id: UUID = Depends(get_current_user)):
    return await build_preview(body, db, user_id)


@router.post("/schedules", response_model=ScheduleResponse, status_code=status.HTTP_200_OK)
async def save_schedule(body: ScheduleRequest, db: Session = Depends(get_db), user_id: UUID = Depends(get_current_user)):
    preview = await build_preview(body, db, user_id)
    if preview.solver_outcome not in ("optimal", "feasible"):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Schedule was not saved because the solver outcome was {preview.solver_outcome}")

    home = db.scalar(select(Home).where(Home.id == body.home_id, Home.user_id == user_id))
    if home is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Home profile not found")
    home_timezone = ZoneInfo(home.settings["location"]["timezone"])
    lock_key = f"{body.home_id}:{body.schedule_date}"
    db.execute(select(func.pg_advisory_xact_lock(func.hashtext(lock_key))))
    schedule = db.scalar(
        select(DailySchedule)
        .where(DailySchedule.home_id == body.home_id, DailySchedule.schedule_date == body.schedule_date)
        .with_for_update()
    )
    old_data = schedule.schedule_data if schedule else None
    revision = schedule.revision + 1 if schedule else 1
    schedule_id = schedule.id if schedule else uuid4()
    changes = build_changes(old_data, preview)
    response = ScheduleResponse(
        schedule_id=schedule_id,
        schedule_date=body.schedule_date,
        revision=revision,
        solver_outcome=preview.solver_outcome,
        task_inputs=body.tasks,
        optimization_goal=body.optimization_goal,
        scheduled_tasks=preview.scheduled_tasks,
        unscheduled_tasks=preview.unscheduled_tasks,
        energy_summary=preview.energy_summary,
        changes=changes,
    )
    response_data = response.model_dump(mode="json")
    now = datetime.now(timezone.utc)

    if schedule is None:
        schedule = DailySchedule(
            id=schedule_id,
            home_id=body.home_id,
            schedule_date=body.schedule_date,
            revision=revision,
            solver_outcome=preview.solver_outcome,
            schedule_data=response_data,
            request_data={
                "tasks": [task.model_dump(mode="json") for task in body.tasks],
                "optimization_goal": body.optimization_goal,
            },
        )
        db.add(schedule)
    else:
        schedule.revision = revision
        schedule.solver_outcome = preview.solver_outcome
        schedule.schedule_data = response_data
        schedule.request_data = {
            "tasks": [task.model_dump(mode="json") for task in body.tasks],
            "optimization_goal": body.optimization_goal,
        }

    try:
        db.flush()
        if schedule.revision > 1:
            db.execute(
                update(Notification)
                .where(
                    Notification.schedule_id == schedule_id,
                    Notification.kind == "task_start",
                    Notification.read_at.is_(None),
                    Notification.cancelled_at.is_(None),
                    Notification.notify_at > now,
                )
                .values(cancelled_at=now)
            )

        task_names = {str(task.task_id): task.name for task in body.tasks}
        for change in changes:
            task_name = task_names.get(str(change.task_id), "A scheduled task")
            db.add(Notification(
                home_id=body.home_id,
                schedule_id=schedule_id,
                task_id=change.task_id,
                kind="schedule_changed",
                title="Schedule updated",
                message=f"{task_name}: {change.reason}",
                notify_at=now,
            ))

        for task in response.scheduled_tasks:
            task_name = task_names.get(str(task.task_id), "Scheduled task")
            for segment in task.segments:
                local_start = datetime.combine(body.schedule_date, time(segment.start_minute // 60, segment.start_minute % 60), tzinfo=home_timezone)
                notify_at = local_start.astimezone(timezone.utc) - timedelta(minutes=5)
                if notify_at > now:
                    db.add(Notification(
                        home_id=body.home_id,
                        schedule_id=schedule_id,
                        task_id=task.task_id,
                        kind="task_start",
                        title="Task starting soon",
                        message=f"{task_name} is scheduled to start at {local_start.strftime('%H:%M')}",
                        notify_at=notify_at,
                    ))

        db.commit()
    except Exception:
        db.rollback()
        raise

    return response


@router.get("/homes/{home_id}/schedules/{schedule_date}", response_model=ScheduleResponse)
def get_saved_schedule(home_id: UUID, schedule_date: date, db: Session = Depends(get_db), user_id: UUID = Depends(get_current_user)):
    schedule = db.scalar(
        select(DailySchedule)
        .join(Home, Home.id == DailySchedule.home_id)
        .where(
            DailySchedule.home_id == home_id,
            DailySchedule.schedule_date == schedule_date,
            Home.user_id == user_id,
        )
    )
    if schedule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved schedule not found")

    response_data = {
        **schedule.schedule_data,
        "schedule_id": str(schedule.id),
        "schedule_date": schedule.schedule_date.isoformat(),
        "revision": schedule.revision,
        "solver_outcome": schedule.solver_outcome,
        "task_inputs": schedule.request_data.get("tasks", schedule.schedule_data.get("task_inputs", [])),
        "optimization_goal": schedule.request_data.get("optimization_goal", schedule.schedule_data.get("optimization_goal")),
    }
    return ScheduleResponse.model_validate(response_data)


@router.get("/notifications", response_model=list[NotificationResponse])
def get_due_notifications(limit: int = Query(default=50, ge=1, le=100), db: Session = Depends(get_db), user_id: UUID = Depends(get_current_user)):
    notifications = db.scalars(
        select(Notification)
        .join(Home, Home.id == Notification.home_id)
        .where(
            Home.user_id == user_id,
            Notification.notify_at <= datetime.now(timezone.utc),
            Notification.read_at.is_(None),
            Notification.cancelled_at.is_(None),
        )
        .order_by(Notification.notify_at.desc())
        .limit(limit)
    ).all()
    return [
        NotificationResponse(
            notification_id=item.id,
            home_id=item.home_id,
            schedule_id=item.schedule_id,
            task_id=item.task_id,
            kind=item.kind,
            title=item.title,
            message=item.message,
            notify_at=item.notify_at,
            created_at=item.created_at,
        )
        for item in notifications
    ]


@router.post("/notifications/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_read(notification_id: UUID, db: Session = Depends(get_db), user_id: UUID = Depends(get_current_user)):
    notification = db.scalar(
        select(Notification)
        .join(Home, Home.id == Notification.home_id)
        .where(Notification.id == notification_id, Home.user_id == user_id)
    )
    if notification is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")

    notification.read_at = datetime.now(timezone.utc)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    return NotificationResponse(
        notification_id=notification.id,
        home_id=notification.home_id,
        schedule_id=notification.schedule_id,
        task_id=notification.task_id,
        kind=notification.kind,
        title=notification.title,
        message=notification.message,
        notify_at=notification.notify_at,
        created_at=notification.created_at,
    )
