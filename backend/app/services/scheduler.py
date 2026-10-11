from dataclasses import dataclass
from math import isfinite
from typing import Literal

from ortools.sat.python import cp_model

from app.schemas import HomeEnergy, RunSegment, ScheduledTask, TaskInput, UnscheduledTask


@dataclass(frozen=True)
class IntervalEnergy:
    solar_generated_kwh: float
    solar_used_kwh: float
    grid_import_kwh: float
    grid_export_kwh: float
    solar_curtailed_kwh: float
    unserved_load_kwh: float
    energy_cost_inr: float
    peak_total_load_kw: float
    exceeds_home_load_limit: bool
    exceeds_grid_import_limit: bool


@dataclass(frozen=True)
class DayEnergy:
    interval_results: tuple[IntervalEnergy, ...]
    solar_generated_kwh: float
    solar_used_kwh: float
    grid_import_kwh: float
    grid_export_kwh: float
    solar_curtailed_kwh: float
    unserved_load_kwh: float
    energy_cost_inr: float
    peak_total_load_kw: float
    exceeds_home_load_limit: bool
    exceeds_grid_import_limit: bool


@dataclass(frozen=True)
class ScheduleSolverResult:
    solver_outcome: Literal["optimal", "feasible", "infeasible", "not_solved"]
    scheduled_tasks: tuple[ScheduledTask, ...]
    unscheduled_tasks: tuple[UnscheduledTask, ...]
    day_energy: DayEnergy | None


def calculate_interval_energy(home: HomeEnergy, solar_generation_kw: list[float], interval_index: int, task_load_by_minute: list[float]) -> IntervalEnergy:
    if len(solar_generation_kw) != 48:
        raise ValueError("solar_generation_kw must contain 48 half-hour values")
    if interval_index < 0 or interval_index >= 48:
        raise ValueError("interval_index must be between 0 and 47")
    if len(task_load_by_minute) != 30:
        raise ValueError("task_load_by_minute must contain 30 values")
    if any(not isfinite(value) or value < 0 for value in task_load_by_minute):
        raise ValueError("task loads must be finite, non-negative kW values")

    baseline_kw = home.electricity.baseline_demand_kw[interval_index]
    solar_kw = solar_generation_kw[interval_index]
    if not isfinite(solar_kw) or solar_kw < 0:
        raise ValueError("solar generation must be a finite, non-negative kW value")

    solar_generated_kwh = 0.0
    solar_used_kwh = 0.0
    grid_import_kwh = 0.0
    grid_export_kwh = 0.0
    solar_curtailed_kwh = 0.0
    unserved_load_kwh = 0.0
    energy_cost_inr = 0.0
    peak_total_load_kw = 0.0
    exceeds_home_load_limit = False
    exceeds_grid_import_limit = False
    tariff_periods = sorted(home.grid_tariffs, key=lambda period: period.start_minute)

    for minute_offset, task_kw in enumerate(task_load_by_minute):
        minute_of_day = interval_index * 30 + minute_offset
        tariff = next((period for period in tariff_periods if period.start_minute <= minute_of_day < period.end_minute), None)
        if tariff is None:
            raise ValueError(f"No electricity tariff covers minute {minute_of_day}")

        total_load_kw = baseline_kw + task_kw
        peak_total_load_kw = max(peak_total_load_kw, total_load_kw)
        exceeds_home_load_limit = exceeds_home_load_limit or total_load_kw > home.electricity.max_total_load_kw

        solar_generated_kwh += solar_kw / 60
        solar_to_load_kw = min(total_load_kw, solar_kw)
        solar_used_kwh += solar_to_load_kw / 60

        required_import_kw = max(0.0, total_load_kw - solar_to_load_kw)
        imported_kw = min(required_import_kw, home.grid_connection.max_import_kw)
        exceeds_grid_import_limit = exceeds_grid_import_limit or required_import_kw > home.grid_connection.max_import_kw
        grid_import_kwh += imported_kw / 60
        unserved_load_kwh += (required_import_kw - imported_kw) / 60
        energy_cost_inr += imported_kw * tariff.import_rate_inr_per_kwh / 60

        surplus_solar_kw = max(0.0, solar_kw - total_load_kw)
        exported_kw = min(surplus_solar_kw, home.grid_connection.max_export_kw)
        curtailed_kw = surplus_solar_kw - exported_kw
        grid_export_kwh += exported_kw / 60
        solar_curtailed_kwh += curtailed_kw / 60
        energy_cost_inr -= exported_kw * tariff.export_credit_inr_per_kwh / 60

    return IntervalEnergy(
        solar_generated_kwh=solar_generated_kwh,
        solar_used_kwh=solar_used_kwh,
        grid_import_kwh=grid_import_kwh,
        grid_export_kwh=grid_export_kwh,
        solar_curtailed_kwh=solar_curtailed_kwh,
        unserved_load_kwh=unserved_load_kwh,
        energy_cost_inr=energy_cost_inr,
        peak_total_load_kw=peak_total_load_kw,
        exceeds_home_load_limit=exceeds_home_load_limit,
        exceeds_grid_import_limit=exceeds_grid_import_limit,
    )


def evaluate_day_energy(home: HomeEnergy, solar_generation_kw: list[float], task_load_by_minute: list[float]) -> DayEnergy:
    if len(task_load_by_minute) != 1440:
        raise ValueError("task_load_by_minute must contain 1440 values, one per minute")

    interval_results = tuple(
        calculate_interval_energy(home, solar_generation_kw, interval_index, task_load_by_minute[interval_index * 30:(interval_index + 1) * 30])
        for interval_index in range(48)
    )

    return DayEnergy(
        interval_results=interval_results,
        solar_generated_kwh=sum(result.solar_generated_kwh for result in interval_results),
        solar_used_kwh=sum(result.solar_used_kwh for result in interval_results),
        grid_import_kwh=sum(result.grid_import_kwh for result in interval_results),
        grid_export_kwh=sum(result.grid_export_kwh for result in interval_results),
        solar_curtailed_kwh=sum(result.solar_curtailed_kwh for result in interval_results),
        unserved_load_kwh=sum(result.unserved_load_kwh for result in interval_results),
        energy_cost_inr=sum(result.energy_cost_inr for result in interval_results),
        peak_total_load_kw=max(result.peak_total_load_kw for result in interval_results),
        exceeds_home_load_limit=any(result.exceeds_home_load_limit for result in interval_results),
        exceeds_grid_import_limit=any(result.exceeds_grid_import_limit for result in interval_results),
    )


def solve_schedule(home: HomeEnergy, solar_generation_kw: list[float], tasks: list[TaskInput], optimization_goal: Literal["maximize_solar_use", "minimize_cost", "reduce_peak_load"]) -> ScheduleSolverResult:
    if len(solar_generation_kw) != 48:
        raise ValueError("solar_generation_kw must contain 48 half-hour values")
    if not tasks:
        raise ValueError("at least one task is required")
    model = cp_model.CpModel()
    running_vars_by_task = []
    scheduled_vars = []
    running_terms_by_minute = [[] for _ in range(1440)]
    task_power_w = [max(1, round(task.power_kw * 1000)) for task in tasks]

    for task_index, task in enumerate(tasks):
        running_vars = {}
        start_vars = []
        scheduled = model.NewBoolVar(f"task_{task_index}_scheduled")
        minimum_segment = min(task.minimum_segment_minutes or 5, task.duration_minutes)
        for minute in range(task.earliest_start_minute, task.latest_finish_minute):
            running_vars[minute] = model.NewBoolVar(f"task_{task_index}_running_{minute}")

        for minute, running in running_vars.items():
            previous_running = running_vars.get(minute - 1, 0)
            starts_here = model.NewBoolVar(f"task_{task_index}_start_{minute}")
            model.Add(starts_here <= running)
            model.Add(starts_here + previous_running <= 1)
            model.Add(starts_here >= running - previous_running)
            start_vars.append(starts_here)

            if minute + minimum_segment > task.latest_finish_minute:
                model.Add(starts_here == 0)
            else:
                for segment_minute in range(minute, minute + minimum_segment):
                    model.Add(running_vars[segment_minute] == 1).OnlyEnforceIf(starts_here)

            running_terms_by_minute[minute].append(task_power_w[task_index] * running)

        model.Add(sum(running_vars.values()) == task.duration_minutes * scheduled)
        model.Add(sum(start_vars) <= task.max_segments * scheduled)
        scheduled_vars.append(scheduled)
        running_vars_by_task.append(running_vars)

    task_count = len(tasks)
    priority_base = task_count + 1
    priority_weights = {"must_finish": priority_base * priority_base, "prefer_solar": priority_base, "flexible": 1}
    priority_score = sum(priority_weights[task.priority] * scheduled_vars[index] for index, task in enumerate(tasks))

    max_load_w = round(home.electricity.max_total_load_kw * 1000)
    max_import_w = round(home.grid_connection.max_import_kw * 1000)

    for minute in range(1440):
        interval_index = minute // 30
        baseline_w = round(home.electricity.baseline_demand_kw[interval_index] * 1000)
        solar_w = round(solar_generation_kw[interval_index] * 1000)
        task_load = sum(running_terms_by_minute[minute])
        # Keep the first solve focused on finding a valid placement. Energy
        # accounting variables are added only after a feasible priority plan
        # exists, which significantly reduces the initial CP-SAT model.
        model.Add(baseline_w + task_load <= max_load_w)
        model.Add(baseline_w + task_load - solar_w <= max_import_w)

    model.Maximize(priority_score)
    priority_solver = cp_model.CpSolver()
    priority_solver.parameters.max_time_in_seconds = 3.0
    priority_solver.parameters.num_search_workers = 8
    priority_status = priority_solver.Solve(model)

    if priority_status == cp_model.INFEASIBLE:
        return ScheduleSolverResult(
            solver_outcome="infeasible",
            scheduled_tasks=(),
            unscheduled_tasks=tuple(UnscheduledTask(task_id=task.task_id, reason="No schedule satisfies the home and grid power limits") for task in tasks),
            day_energy=None,
        )
    if priority_status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return ScheduleSolverResult(
            solver_outcome="not_solved",
            scheduled_tasks=(),
            unscheduled_tasks=tuple(UnscheduledTask(task_id=task.task_id, reason="The solver did not find a schedule before its time limit") for task in tasks),
            day_energy=None,
        )

    best_priority_score = priority_solver.Value(priority_score)
    model.Add(priority_score == best_priority_score)

    total_load_vars = []
    solar_used_vars = []
    cost_terms = []
    max_export_w = round(home.grid_connection.max_export_kw * 1000)
    sorted_tariffs = sorted(home.grid_tariffs, key=lambda period: period.start_minute)
    for minute in range(1440):
        interval_index = minute // 30
        baseline_w = round(home.electricity.baseline_demand_kw[interval_index] * 1000)
        solar_w = round(solar_generation_kw[interval_index] * 1000)
        total_load = model.NewIntVar(0, max_load_w, f"total_load_w_{minute}")
        model.Add(total_load == baseline_w + sum(running_terms_by_minute[minute]))
        total_load_vars.append(total_load)

        import_w = model.NewIntVar(0, max_import_w, f"grid_import_w_{minute}")
        model.AddMaxEquality(import_w, [total_load - solar_w, 0])

        solar_used_w = model.NewIntVar(0, max_load_w, f"solar_used_w_{minute}")
        model.AddMinEquality(solar_used_w, [total_load, solar_w])
        solar_used_vars.append(solar_used_w)

        surplus_w = model.NewIntVar(0, solar_w, f"solar_surplus_w_{minute}")
        model.AddMaxEquality(surplus_w, [solar_w - total_load, 0])
        export_w = model.NewIntVar(0, max_export_w, f"grid_export_w_{minute}")
        model.AddMinEquality(export_w, [surplus_w, max_export_w])

        tariff = next((period for period in sorted_tariffs if period.start_minute <= minute < period.end_minute), None)
        if tariff is None:
            raise ValueError(f"No electricity tariff covers minute {minute}")
        import_rate_paise = round(tariff.import_rate_inr_per_kwh * 100)
        export_credit_paise = round(tariff.export_credit_inr_per_kwh * 100)
        cost_terms.append(import_w * import_rate_paise - export_w * export_credit_paise)

    peak_load_w = model.NewIntVar(0, max_load_w, "peak_load_w")
    model.AddMaxEquality(peak_load_w, total_load_vars)
    if optimization_goal == "maximize_solar_use":
        model.Maximize(sum(solar_used_vars))
    elif optimization_goal == "minimize_cost":
        model.Minimize(sum(cost_terms))
    elif optimization_goal == "reduce_peak_load":
        model.Minimize(peak_load_w)
    else:
        raise ValueError("unsupported optimization goal")

    energy_solver = cp_model.CpSolver()
    energy_solver.parameters.max_time_in_seconds = 3.0
    energy_solver.parameters.num_search_workers = 8
    energy_status = energy_solver.Solve(model)
    energy_solution_used = energy_status in (cp_model.OPTIMAL, cp_model.FEASIBLE)
    if energy_solution_used:
        solver = energy_solver
    else:
        solver = priority_solver

    task_load_by_minute = [0.0] * 1440
    scheduled_tasks = []
    unscheduled_tasks = []
    if energy_solution_used:
        goal_reason = {
            "maximize_solar_use": "Chosen to increase estimated solar use while respecting power limits",
            "minimize_cost": "Chosen to reduce estimated electricity cost while respecting power limits",
            "reduce_peak_load": "Chosen to reduce the household peak load while respecting power limits",
        }[optimization_goal]
    else:
        goal_reason = "Placed to satisfy task priorities and power limits; the energy optimization reached its time limit"

    for task_index, task in enumerate(tasks):
        active_minutes = [minute for minute, running in running_vars_by_task[task_index].items() if solver.Value(running)]
        if not active_minutes:
            unscheduled_tasks.append(UnscheduledTask(task_id=task.task_id, reason="No feasible placement was selected within its time window and power limits"))
            continue

        segments = []
        segment_start = active_minutes[0]
        previous_minute = active_minutes[0]
        for minute in active_minutes[1:]:
            if minute != previous_minute + 1:
                segments.append(RunSegment(start_minute=segment_start, end_minute=previous_minute + 1))
                segment_start = minute
            previous_minute = minute
        segments.append(RunSegment(start_minute=segment_start, end_minute=previous_minute + 1))
        for minute in active_minutes:
            task_load_by_minute[minute] += task.power_kw
        scheduled_tasks.append(ScheduledTask(task_id=task.task_id, segments=segments, reason=goal_reason))

    day_energy = evaluate_day_energy(home, solar_generation_kw, task_load_by_minute)
    outcome = "optimal" if priority_status == cp_model.OPTIMAL and energy_status == cp_model.OPTIMAL else "feasible"
    return ScheduleSolverResult(
        solver_outcome=outcome,
        scheduled_tasks=tuple(scheduled_tasks),
        unscheduled_tasks=tuple(unscheduled_tasks),
        day_energy=day_energy
    )
