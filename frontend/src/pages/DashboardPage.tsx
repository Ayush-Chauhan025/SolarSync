import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, CalendarPlus, Clock3, Settings2, Sun } from 'lucide-react'
import { Link } from 'react-router-dom'
import EnergyChart from '../components/EnergyChart'
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncState'
import { useHomes } from '../home/useHomes'
import { apiRequest, ApiError } from '../lib/api'
import { localDateForTimezone, minuteLabel } from '../lib/time'
import type { ScheduleResult, SolarForecast } from '../types'

export default function DashboardPage() {
  const { activeHome, loading: homeLoading, error: homeError, refresh: refreshHomes } = useHomes()
  const date = activeHome ? localDateForTimezone(activeHome.settings.location.timezone) : ''
  const [forecast, setForecast] = useState<SolarForecast | null>(null)
  const [forecastError, setForecastError] = useState('')
  const [forecastLoading, setForecastLoading] = useState(false)
  const [schedule, setSchedule] = useState<ScheduleResult | null>(null)
  const [scheduleError, setScheduleError] = useState('')
  const [scheduleLoading, setScheduleLoading] = useState(false)

  const loadForecast = useCallback(async () => {
    if (!activeHome || !date) return
    setForecastLoading(true)
    setForecastError('')
    try {
      setForecast(await apiRequest<SolarForecast>(`/homes/${activeHome.home_id}/solar-forecast?forecast_date=${date}`))
    } catch (cause) {
      setForecastError(cause instanceof Error ? cause.message : 'Could not load the solar forecast.')
    } finally { setForecastLoading(false) }
  }, [activeHome, date])

  const loadSchedule = useCallback(async () => {
    if (!activeHome || !date) return
    setScheduleLoading(true)
    setScheduleError('')
    try {
      setSchedule(await apiRequest<ScheduleResult>(`/homes/${activeHome.home_id}/schedules/${date}`))
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 404) setSchedule(null)
      else setScheduleError(cause instanceof Error ? cause.message : 'Could not load the saved schedule.')
    } finally { setScheduleLoading(false) }
  }, [activeHome, date])

  useEffect(() => { setForecast(null); setSchedule(null); void loadForecast(); void loadSchedule() }, [loadForecast, loadSchedule])

  const home = activeHome?.settings
  const dateLabel = useMemo(() => date ? new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`)) : '', [date])
  const taskNames = new Map((schedule?.task_inputs ?? []).map((task) => [task.task_id, task.name]))
  const scheduledRows = (schedule?.scheduled_tasks ?? []).flatMap((task) => task.segments.map((segment, index) => ({
    id: `${task.task_id}-${index}`,
    taskId: task.task_id,
    name: taskNames.get(task.task_id) ?? 'Task',
    start: segment.start_minute,
    end: segment.end_minute,
    reason: task.reason,
  }))).sort((a, b) => a.start - b.start)

  if (homeLoading) return <LoadingState label="Loading your home…" />
  if (homeError) return <ErrorState message={homeError} onRetry={() => void refreshHomes()} />
  if (!activeHome) return <section className="dashboard-onboarding"><div className="date-line">YOUR HOME, YOUR ENERGY</div><h1>Start with your solar setup.</h1><p>Add your location, solar system, and household demand to get a forecast and build your first schedule.</p><Link className="primary-button" to="/app/energy">Set up energy profile <ArrowRight size={15} /></Link></section>

  return (
    <div className="dashboard-page">
      <header className="page-heading">
        <div><div className="date-line">{dateLabel}</div><h1>Today</h1><p>Solar forecast and scheduled home tasks.</p></div>
        <Link className="primary-button" to="/app/schedule"><CalendarPlus size={16} />Plan this day</Link>
      </header>

      <div className="overview-grid">
        <section className="surface forecast-panel" aria-labelledby="forecast-title">
          <div className="surface-heading"><div><p className="overline">SOLAR FORECAST</p><h2 id="forecast-title">Generation &amp; baseline demand</h2></div><span className="unit-label">POWER · kW</span></div>
          <div className="chart-legend"><span><i className="legend-mark solar-mark" />Solar generation</span><span><i className="legend-mark demand-mark" />Baseline demand</span></div>
          {forecastLoading ? <LoadingState label="Loading solar forecast…" /> : forecastError ? <ErrorState message={forecastError} onRetry={() => void loadForecast()} /> : forecast && home ? <EnergyChart solar={forecast.solar_generation_kw} home={home.electricity.baseline_demand_kw} /> : <EmptyState title="No forecast for this date" description="Try refreshing the forecast or review your home location and panel settings." />}
          {forecast && <div className="forecast-note"><Sun size={16} /><p><strong>{forecast.estimated_total_generation_kwh.toFixed(1)} kWh estimated today.</strong> Forecast from {forecast.provider}. <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Data attribution</a></p></div>}
        </section>

        <aside className="surface profile-panel" aria-labelledby="profile-title">
          <div className="surface-heading profile-heading"><div><p className="overline">HOME PROFILE</p><h2 id="profile-title">Solar system</h2></div><Link className="quiet-icon-button" to="/app/energy" aria-label="Edit home profile"><Settings2 size={17} /></Link></div>
          <div className="profile-capacity"><span className="capacity-icon"><Sun size={18} /></span><div><strong>{home?.solar_system.rated_capacity_kwp} <small>kWp</small></strong><span>Installed solar capacity</span></div></div>
          <dl className="profile-details"><div><dt>Panel direction</dt><dd>{home?.solar_system.panel_direction}</dd></div><div><dt>Inverter limit</dt><dd>{home?.solar_system.max_inverter_output_kw} kW</dd></div><div><dt>Timezone</dt><dd>{home?.location.timezone}</dd></div></dl>
          <Link className="inline-link" to="/app/energy">Edit energy profile <ArrowRight size={14} /></Link>
        </aside>
      </div>

      <section className="surface plan-panel" aria-labelledby="plan-title">
        <div className="surface-heading plan-heading"><div><p className="overline">SAVED SCHEDULE</p><h2 id="plan-title">Today's plan</h2></div><div className="plan-actions">{schedule && <span className="unsaved-label">Revision {schedule.revision}</span>}<Link className="inline-link" to="/app/schedule">Open schedule <ArrowRight size={14} /></Link></div></div>
        {scheduleLoading ? <LoadingState label="Loading today's saved schedule…" /> : scheduleError ? <ErrorState message={scheduleError} onRetry={() => void loadSchedule()} /> : scheduledRows.length ? <>
          <div className="task-table-head"><span>TIME</span><span>TASK</span><span>RUN TIME</span><span>PLACEMENT</span></div>
          <div className="task-list">{scheduledRows.map((row) => <article className="task-row" key={row.id}><div className="task-time"><Clock3 size={14} />{minuteLabel(row.start)}–{minuteLabel(row.end)}</div><div className="task-main"><strong>{row.name}</strong><span>{schedule?.task_inputs?.find((task) => task.task_id === row.taskId)?.priority?.replace('_', ' ')}</span></div><div className="task-detail">{row.end - row.start} min</div><div className="placement-label">{row.reason}</div></article>)}</div>
        </> : <EmptyState title="No schedule saved for today" description="Add tasks and preview a plan to see your household's schedule here." action={<Link className="inline-link" to="/app/schedule">Create today's schedule →</Link>} />}
      </section>
      {forecast && <footer className="data-note"><span>{forecast.attribution}</span><span>Forecast fetched {new Date(forecast.fetched_at).toLocaleTimeString()}</span></footer>}
    </div>
  )
}
