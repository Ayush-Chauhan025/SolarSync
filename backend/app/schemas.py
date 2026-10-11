from typing import Annotated, Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from pydantic import BaseModel, Field, field_validator, model_validator
from uuid import UUID
from datetime import date, datetime

PositiveFloat = Annotated[float, Field(gt=0)]
NonNegativeFloat = Annotated[float, Field(ge=0)]


class AuthCredentials(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, value: str) -> str:
        value = value.strip()
        if "@" not in value or value.startswith("@") or value.endswith("@"):
            raise ValueError("Enter a valid email address")
        return value


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(min_length=1)


class AuthUserResponse(BaseModel):
    id: UUID
    email: str | None = None


class AuthResponse(BaseModel):
    user: AuthUserResponse
    access_token: str | None = None
    refresh_token: str | None = None
    token_type: str | None = None
    expires_in: int | None = None
    expires_at: int | None = None
    message: str


class LogoutResponse(BaseModel):
    message: str

class Location(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    timezone: str

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError:
            raise ValueError("timezone must be a valid IANA timezone")
        return value

class SolarSystem(BaseModel):
    rated_capacity_kwp: PositiveFloat
    panel_tilt_degrees: float = Field(ge=0, le=90)
    panel_direction: Literal["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    max_inverter_output_kw: PositiveFloat
    system_performance_ratio: float | None = Field(default=None, gt=0, le=1)


class SolarForecastResponse(BaseModel):
    solar_generation_kw: list[NonNegativeFloat] = Field(min_length=48, max_length=48)
    estimated_total_generation_kwh: NonNegativeFloat
    provider: Literal["Open-Meteo"]
    attribution: str
    fetched_at: datetime


class Electricity(BaseModel):
    baseline_demand_kw: list[NonNegativeFloat] = Field(min_length=48, max_length=48)
    max_total_load_kw: PositiveFloat


class GridConnection(BaseModel):
    max_import_kw: PositiveFloat
    max_export_kw: NonNegativeFloat

class GridTariffPeriod(BaseModel):
    start_minute: int = Field(ge=0, le=1439)
    end_minute: int = Field(gt=0, le=1440)
    import_rate_inr_per_kwh: NonNegativeFloat
    export_credit_inr_per_kwh: NonNegativeFloat

    @model_validator(mode="after")
    def validate_period(self):
        if self.end_minute <= self.start_minute:
            raise ValueError("end_minute must be later than start_minute")
        return self

class HomeEnergy(BaseModel):
    location: Location
    solar_system: SolarSystem
    electricity: Electricity
    grid_connection: GridConnection
    grid_tariffs: list[GridTariffPeriod] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_tariff_coverage(self):
        periods = sorted(self.grid_tariffs, key=lambda period: period.start_minute)

        if periods[0].start_minute != 0:
            raise ValueError("grid tariffs must start at minute 0")

        if periods[-1].end_minute != 1440:
            raise ValueError("grid tariffs must end at minute 1440")

        for current, following in zip(periods, periods[1:]):
            if current.end_minute != following.start_minute:
                raise ValueError( "grid tariff periods must be contiguous and must not overlap")

        return self


class HomeProfileData(BaseModel):
    home_id: UUID
    settings: HomeEnergy


class HomeProfileResponse(BaseModel):
    status: Literal["ok"]
    body: HomeProfileData


class HomeListItem(BaseModel):
    home_id: UUID
    settings: HomeEnergy


class HomeListResponse(BaseModel):
    homes: list[HomeListItem]

class TaskDefinition(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    power_kw: PositiveFloat
    duration_minutes: int = Field(gt=0)

    earliest_start_minute: int = Field(ge=0, lt=1440)
    latest_finish_minute: int = Field(gt=0, le=1440)

    priority: Literal["must_finish", "prefer_solar", "flexible"]
    
    max_segments: int = Field(default=1, ge=1, le=1440)
    minimum_segment_minutes: int | None = Field(default=5, gt=0)

    @model_validator(mode="after")
    def validate_definition(self):
        if self.earliest_start_minute >= self.latest_finish_minute:
            raise ValueError("latest_finish_minute must be after earliest_start_minute")

        available_minutes = self.latest_finish_minute - self.earliest_start_minute
        if self.duration_minutes > available_minutes:
            raise ValueError("task duration does not fit inside its time window")

        if "minimum_segment_minutes" in self.model_fields_set and self.minimum_segment_minutes is not None and self.minimum_segment_minutes > self.duration_minutes:
            raise ValueError("minimum_segment_minutes cannot exceed duration_minutes")

        return self


class TaskPresetInput(TaskDefinition):
    """Reusable task details submitted when creating a saved preset."""


class TaskPreset(TaskPresetInput):
    preset_id: UUID


class TaskInput(TaskDefinition):
    task_id: UUID
    preset_id: UUID | None = None

class ScheduleRequest(BaseModel):
    home_id: UUID
    schedule_date: date
    tasks: list[TaskInput] = Field(min_length=1, max_length=50)
    optimization_goal: Literal["maximize_solar_use", "minimize_cost", "reduce_peak_load"]

class RunSegment(BaseModel):
    start_minute: int = Field(ge=0, le=1439)
    end_minute: int = Field(ge=1, le=1440)

    @model_validator(mode="after")
    def validate_segment(self):
        if self.start_minute >= self.end_minute:
            raise ValueError("end_minute must be after start_minute")
        return self

class ScheduledTask(BaseModel):
    task_id: UUID
    segments: list[RunSegment] = Field(min_length=1)
    reason: str

    @model_validator(mode="after")
    def validate_segments(self):
        for current, following in zip(self.segments, self.segments[1:]):
            if current.end_minute > following.start_minute:
                raise ValueError("task segments must be ordered and must not overlap")
        return self

class UnscheduledTask(BaseModel):
    task_id: UUID
    reason: str

class EnergySummary(BaseModel):
    grid_import_before_kwh: NonNegativeFloat | None = None
    grid_import_after_kwh: NonNegativeFloat
    solar_used_before_kwh: NonNegativeFloat | None = None
    solar_used_after_kwh: NonNegativeFloat
    grid_export_after_kwh: NonNegativeFloat | None = None
    estimated_cost_before_inr: float | None = None
    estimated_cost_after_inr: float | None = None


class SchedulePreviewResponse(BaseModel):
    schedule_date: date
    solver_outcome: Literal["optimal", "feasible", "infeasible", "not_solved"]
    scheduled_tasks: list[ScheduledTask]
    unscheduled_tasks: list[UnscheduledTask]
    energy_summary: EnergySummary | None = None

class ScheduleChange(BaseModel):
    task_id: UUID
    change_type: Literal["added", "moved", "removed", "unscheduled"]
    previous_segments: list[RunSegment] | None = None
    new_segments: list[RunSegment] | None = None
    reason: str

class ScheduleResponse(BaseModel):
    schedule_id: UUID
    schedule_date: date
    revision: int = Field(ge=1)
    solver_outcome: Literal["optimal", "feasible", "infeasible", "not_solved"]
    task_inputs: list[TaskInput] = Field(default_factory=list)
    optimization_goal: Literal["maximize_solar_use", "minimize_cost", "reduce_peak_load"] | None = None
    scheduled_tasks: list[ScheduledTask]
    unscheduled_tasks: list[UnscheduledTask]
    energy_summary: EnergySummary | None = None
    changes: list[ScheduleChange] = Field(default_factory=list)


class NotificationResponse(BaseModel):
    notification_id: UUID
    home_id: UUID
    schedule_id: UUID
    task_id: UUID | None = None
    kind: Literal["task_start", "schedule_changed"]
    title: str
    message: str
    notify_at: datetime
    created_at: datetime
