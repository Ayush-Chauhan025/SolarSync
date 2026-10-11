export type Priority = 'must_finish' | 'prefer_solar' | 'flexible'
export type OptimizationGoal = 'maximize_solar_use' | 'minimize_cost' | 'reduce_peak_load'
export type PanelDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'

export type HomeEnergy = {
  location: { latitude: number; longitude: number; timezone: string }
  solar_system: {
    rated_capacity_kwp: number
    panel_tilt_degrees: number
    panel_direction: PanelDirection
    max_inverter_output_kw: number
    system_performance_ratio: number | null
  }
  electricity: { baseline_demand_kw: number[]; max_total_load_kw: number }
  grid_connection: { max_import_kw: number; max_export_kw: number }
  grid_tariffs: Array<{
    start_minute: number
    end_minute: number
    import_rate_inr_per_kwh: number
    export_credit_inr_per_kwh: number
  }>
}

export type HomeItem = { home_id: string; settings: HomeEnergy }
export type TaskPreset = {
  preset_id: string
  name: string
  power_kw: number
  duration_minutes: number
  earliest_start_minute: number
  latest_finish_minute: number
  priority: Priority
  max_segments: number
  minimum_segment_minutes: number | null
}
export type TaskInput = Omit<TaskPreset, 'preset_id'> & { task_id: string; preset_id: string | null }
export type RunSegment = { start_minute: number; end_minute: number }
export type ScheduledTask = { task_id: string; segments: RunSegment[]; reason: string }
export type UnscheduledTask = { task_id: string; reason: string }
export type EnergySummary = {
  grid_import_before_kwh: number | null
  grid_import_after_kwh: number
  solar_used_before_kwh: number | null
  solar_used_after_kwh: number
  grid_export_after_kwh: number | null
  estimated_cost_before_inr: number | null
  estimated_cost_after_inr: number | null
}
export type ScheduleResult = {
  schedule_id?: string
  schedule_date: string
  revision?: number
  solver_outcome: 'optimal' | 'feasible' | 'infeasible' | 'not_solved'
  task_inputs?: TaskInput[]
  optimization_goal?: OptimizationGoal | null
  scheduled_tasks: ScheduledTask[]
  unscheduled_tasks: UnscheduledTask[]
  energy_summary: EnergySummary | null
  changes?: Array<{ task_id: string; change_type: string; reason: string }>
}
export type SolarForecast = {
  solar_generation_kw: number[]
  estimated_total_generation_kwh: number
  provider: 'Open-Meteo'
  attribution: string
  fetched_at: string
}
export type NotificationItem = {
  notification_id: string
  home_id: string
  schedule_id: string
  task_id: string | null
  kind: 'task_start' | 'schedule_changed'
  title: string
  message: string
  notify_at: string
  created_at: string
}
