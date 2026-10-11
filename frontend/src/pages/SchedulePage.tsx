import { useCallback, useEffect, useMemo, useState } from 'react'
import { Clock3, Plus, Save, Sparkles, Trash2, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { FormEvent } from 'react'
import SectionTitle from '../components/SectionTitle'
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncState'
import { useHomes } from '../home/useHomes'
import { apiRequest, ApiError } from '../lib/api'
import { localDateForTimezone, minuteLabel } from '../lib/time'
import type { OptimizationGoal, Priority, ScheduleResult, TaskInput, TaskPreset } from '../types'

const goals: Array<{ value: OptimizationGoal; label: string }> = [
  { value: 'maximize_solar_use', label: 'Use more solar' },
  { value: 'minimize_cost', label: 'Reduce estimated cost' },
  { value: 'reduce_peak_load', label: 'Lower peak load' },
]
const priorities: Priority[] = ['must_finish', 'prefer_solar', 'flexible']

function formatKwh(value: number | null | undefined) {
  return value === null || value === undefined ? '—' : `${value.toFixed(2)} kWh`
}

export default function SchedulePage() {
  const { activeHome } = useHomes()
  const homeDate = activeHome ? localDateForTimezone(activeHome.settings.location.timezone) : ''
  const [date, setDate] = useState(homeDate)
  const [presets, setPresets] = useState<TaskPreset[]>([])
  const [tasks, setTasks] = useState<TaskInput[]>([])
  const [goal, setGoal] = useState<OptimizationGoal>('maximize_solar_use')
  const [loading, setLoading] = useState(Boolean(activeHome))
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ScheduleResult | null>(null)
  const [saved, setSaved] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState('')
  const [manualOpen, setManualOpen] = useState(false)

  const load = useCallback(async () => {
    if (!activeHome) { setLoading(false); setPresets([]); setResult(null); setTasks([]); return }
    if (!date) return
    setLoading(true)
    setError('')
    setSaved(false)
    try {
      const [loadedPresets, loadedSchedule] = await Promise.all([
        apiRequest<TaskPreset[]>(`/homes/${activeHome.home_id}/task-presets`),
        apiRequest<ScheduleResult>(`/homes/${activeHome.home_id}/schedules/${date}`).catch((cause: unknown) => {
          if (cause instanceof ApiError && cause.status === 404) return null
          throw cause
        }),
      ])
      setPresets(loadedPresets)
      setResult(loadedSchedule)
      setTasks(loadedSchedule?.task_inputs ?? [])
      if (loadedSchedule?.optimization_goal) setGoal(loadedSchedule.optimization_goal)
      setSaved(Boolean(loadedSchedule))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load schedule data.')
    } finally { setLoading(false) }
  }, [activeHome, date])

  useEffect(() => { setDate(homeDate) }, [homeDate])
  useEffect(() => { void load() }, [load])

  const presetOptions = useMemo(() => presets, [presets])

  function addTask() {
    const preset = presets.find((item) => item.preset_id === selectedPreset)
    if (!preset) return
    setTasks((current) => [...current, { ...preset, task_id: crypto.randomUUID() }])
    setSelectedPreset('')
    setSaved(false)
  }

  function updatePriority(taskId: string, priority: Priority) {
    setTasks((current) => current.map((task) => task.task_id === taskId ? { ...task, priority } : task))
    setSaved(false)
  }

  function addManualTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const startMinute = Number((String(form.get('start_time')).split(':')[0])) * 60 + Number(String(form.get('start_time')).split(':')[1])
    const finishMinute = Number((String(form.get('finish_time')).split(':')[0])) * 60 + Number(String(form.get('finish_time')).split(':')[1])
    const duration = Number(form.get('duration_minutes'))
    if (finishMinute <= startMinute) { setError('The finish time must be after the earliest start time.'); return }
    if (duration > finishMinute - startMinute) { setError('The task duration must fit inside the selected time window.'); return }
    const priority = String(form.get('priority')) as Priority
    setTasks((current) => [...current, {
      task_id: crypto.randomUUID(),
      preset_id: null,
      name: String(form.get('name')).trim(),
      power_kw: Number(form.get('power_kw')),
      duration_minutes: duration,
      earliest_start_minute: startMinute,
      latest_finish_minute: finishMinute,
      priority,
      max_segments: 1,
      minimum_segment_minutes: null,
    }])
    setManualOpen(false)
    setSaved(false)
    setError('')
  }

  async function preview(save: boolean) {
    if (!activeHome || !tasks.length) return
    setWorking(true)
    setError('')
    try {
      const path = save ? '/schedules' : '/schedules/preview'
      const next = await apiRequest<ScheduleResult>(path, {
        method: 'POST',
        body: JSON.stringify({ home_id: activeHome.home_id, schedule_date: date, tasks, optimization_goal: goal }),
      })
      setResult({ ...next, task_inputs: next.task_inputs ?? tasks, optimization_goal: next.optimization_goal ?? goal })
      setSaved(save)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The schedule could not be calculated.')
    } finally { setWorking(false) }
  }

  if (loading) return <LoadingState label="Loading tasks and saved schedule…" />
  return (
    <section className="schedule-page">
      <SectionTitle eyebrow="PLAN AHEAD" title="Your schedule" description="Choose the saved tasks for this day. SolarSync will compare their allowed windows with your solar forecast and home demand." />
      {!activeHome && <EmptyState title="Set up your home first" description="A home energy profile is needed to calculate solar generation and load constraints." action={<Link className="inline-link" to="/app/energy">Set up your home →</Link>} />}
      {activeHome && <>
        {error && <ErrorState message={error} onRetry={() => void load()} />}
        <div className="schedule-controls surface">
          <label>Schedule date<input type="date" value={date} min={homeDate} onChange={(event) => setDate(event.target.value)} /></label>
          <label>Optimization goal<select value={goal} onChange={(event) => { setGoal(event.target.value as OptimizationGoal); setSaved(false) }}>{goals.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <div className="add-task-control"><label htmlFor="preset-select">Add a saved task</label><div><select id="preset-select" value={selectedPreset} onChange={(event) => setSelectedPreset(event.target.value)}><option value="">Choose an appliance</option>{presetOptions.map((preset) => <option key={preset.preset_id} value={preset.preset_id}>{preset.name}</option>)}</select><button className="secondary-button" type="button" onClick={addTask} disabled={!selectedPreset}><Plus size={15} />Add</button><button className="secondary-button" type="button" onClick={() => setManualOpen((open) => !open)}>{manualOpen ? <X size={15} /> : <Plus size={15} />}{manualOpen ? 'Cancel' : 'One-off task'}</button></div></div>
        </div>
        {manualOpen && <form className="manual-task-form surface" onSubmit={addManualTask}>
          <div className="form-card-heading"><div><p className="overline">FOR THIS SCHEDULE ONLY</p><h2>Add a one-off task</h2></div></div>
          <div className="form-grid three-columns"><label className="span-two">Task name<input name="name" maxLength={120} required /></label><label>Power (kW)<input name="power_kw" type="number" min="0.01" step="0.01" required /></label><label>Run time (minutes)<input name="duration_minutes" type="number" min="1" step="1" required /></label><label>Earliest start<input name="start_time" type="time" required /></label><label>Latest finish<input name="finish_time" type="time" required /></label><label>Priority<select name="priority" defaultValue="prefer_solar"><option value="must_finish">Must finish</option><option value="prefer_solar">Prefer solar</option><option value="flexible">Flexible</option></select></label></div>
          <div className="form-actions"><span>This task will be included in this day's schedule only.</span><button className="primary-button" type="submit"><Plus size={15} />Add one-off task</button></div>
        </form>}
        {!presets.length && <EmptyState title="No saved appliances" description="Save your recurring tasks before building a schedule." action={<Link className="inline-link" to="/app/tasks">Add appliances →</Link>} />}
        {tasks.length > 0 && <section className="surface selected-tasks-panel">
          <header className="surface-heading"><div><p className="overline">TASKS FOR THIS DAY</p><h2>{tasks.length} {tasks.length === 1 ? 'task' : 'tasks'} selected</h2></div><span className="unit-label">{date}</span></header>
          <div className="selected-task-list">{tasks.map((task) => <article className="selected-task-row" key={task.task_id}>
            <span className="preset-icon"><Clock3 size={16} /></span><div className="selected-task-main"><strong>{task.name}</strong><span>{task.power_kw} kW · {task.duration_minutes} min · {minuteLabel(task.earliest_start_minute)} to {minuteLabel(task.latest_finish_minute)}</span></div>
            <select aria-label={`Priority for ${task.name}`} value={task.priority} onChange={(event) => updatePriority(task.task_id, event.target.value as Priority)}>{priorities.map((priority) => <option key={priority} value={priority}>{priority.replace('_', ' ')}</option>)}</select>
            <button type="button" className="quiet-icon-button danger-icon" aria-label={`Remove ${task.name}`} onClick={() => { setTasks((current) => current.filter((item) => item.task_id !== task.task_id)); setSaved(false) }}><Trash2 size={15} /></button>
          </article>)}</div>
          <div className="form-actions schedule-actions"><span>{saved ? `Saved revision ${result?.revision ?? ''}` : 'Preview before saving. Saving replaces this home’s schedule for the selected date.'}</span><div><button type="button" className="secondary-button" onClick={() => void preview(false)} disabled={working}>{working ? 'Calculating…' : <><Sparkles size={15} />Preview plan</>}</button><button type="button" className="primary-button" onClick={() => void preview(true)} disabled={working}>{working ? 'Saving…' : <><Save size={15} />Save schedule</>}</button></div></div>
        </section>}
        {result && <ScheduleResultView result={result} />}
      </>}
    </section>
  )
}

function ScheduleResultView({ result }: { result: ScheduleResult }) {
  const names = new Map((result.task_inputs ?? []).map((task) => [task.task_id, task.name]))
  return <section className="schedule-result surface">
    <div className="surface-heading"><div><p className="overline">{result.schedule_id ? 'SAVED PLAN' : 'PREVIEW'}</p><h2>Optimization result</h2></div><span className={`solver-status ${result.solver_outcome}`}>{result.solver_outcome.replace('_', ' ')}</span></div>
    {result.energy_summary && <div className="energy-summary-grid">
      <div><span>Solar used</span><strong>{formatKwh(result.energy_summary.solar_used_after_kwh)}</strong><small>before: {formatKwh(result.energy_summary.solar_used_before_kwh)}</small></div>
      <div><span>Grid import</span><strong>{formatKwh(result.energy_summary.grid_import_after_kwh)}</strong><small>before: {formatKwh(result.energy_summary.grid_import_before_kwh)}</small></div>
      <div><span>Estimated cost</span><strong>{result.energy_summary.estimated_cost_after_inr == null ? '—' : `₹${result.energy_summary.estimated_cost_after_inr.toFixed(2)}`}</strong><small>before: {result.energy_summary.estimated_cost_before_inr == null ? '—' : `₹${result.energy_summary.estimated_cost_before_inr.toFixed(2)}`}</small></div>
    </div>}
    {result.scheduled_tasks.length ? <div className="result-task-list">{result.scheduled_tasks.map((task) => <article key={task.task_id}><strong>{names.get(task.task_id) ?? 'Task'}</strong><div>{task.segments.map((segment, index) => <span key={`${segment.start_minute}-${index}`}>{minuteLabel(segment.start_minute)}–{minuteLabel(segment.end_minute)}</span>)}</div><p>{task.reason}</p></article>)}</div> : <EmptyState title="No tasks could be placed" description="Review the task time windows, power limits, and home profile, then adjust the plan." />}
    {result.unscheduled_tasks.length > 0 && <div className="unscheduled-list"><h3>Could not schedule</h3>{result.unscheduled_tasks.map((task) => <p key={task.task_id}><strong>{names.get(task.task_id) ?? 'Task'}:</strong> {task.reason}</p>)}</div>}
    {result.changes?.length ? <div className="schedule-change-list"><h3>Changes from the previous plan</h3>{result.changes.map((change, index) => <p key={`${change.task_id}-${index}`}>{names.get(change.task_id) ?? 'Task'} · {change.change_type}: {change.reason}</p>)}</div> : null}
  </section>
}
