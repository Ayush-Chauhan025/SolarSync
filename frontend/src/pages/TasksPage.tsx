import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Clock3, Pencil, Plus, Trash2, WashingMachine, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import SectionTitle from '../components/SectionTitle'
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncState'
import { useHomes } from '../home/useHomes'
import { apiRequest } from '../lib/api'
import { minuteInputValue, minuteLabel, parseTime } from '../lib/time'
import type { Priority, TaskPreset } from '../types'

const priorities: Array<{ value: Priority; label: string }> = [
  { value: 'must_finish', label: 'Must finish' },
  { value: 'prefer_solar', label: 'Prefer solar' },
  { value: 'flexible', label: 'Flexible' },
]

export default function TasksPage() {
  const { activeHome } = useHomes()
  const [tasks, setTasks] = useState<TaskPreset[]>([])
  const [loading, setLoading] = useState(Boolean(activeHome))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState<TaskPreset | null>(null)

  const loadTasks = useCallback(async () => {
    if (!activeHome) { setTasks([]); setLoading(false); return }
    setLoading(true)
    setError('')
    try {
      setTasks(await apiRequest<TaskPreset[]>(`/homes/${activeHome.home_id}/task-presets`))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load saved tasks.')
    } finally { setLoading(false) }
  }, [activeHome])

  useEffect(() => { void loadTasks(); setEditing(null) }, [loadTasks])

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activeHome) return
    const form = new FormData(event.currentTarget)
    const start = parseTime(String(form.get('earliest_start')))
    const finish = parseTime(String(form.get('latest_finish')))
    const duration = Number(form.get('duration_minutes'))
    if (finish <= start) { setError('The finish time must be after the earliest start time.'); return }
    if (duration > finish - start) { setError('The task duration must fit inside the selected time window.'); return }

    const payload = {
      name: String(form.get('name')).trim(),
      power_kw: Number(form.get('power_kw')),
      duration_minutes: duration,
      earliest_start_minute: start,
      latest_finish_minute: finish,
      priority: String(form.get('priority')) as Priority,
      max_segments: Number(form.get('max_segments')),
      minimum_segment_minutes: form.get('minimum_segment_minutes') ? Number(form.get('minimum_segment_minutes')) : null,
    }
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const path = `/homes/${activeHome.home_id}/task-presets${editing ? `/${editing.preset_id}` : ''}`
      const saved = await apiRequest<TaskPreset>(path, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(payload) })
      setTasks((current) => editing ? current.map((task) => task.preset_id === saved.preset_id ? saved : task) : [...current, saved])
      setEditing(null)
      setNotice(editing ? 'Task preset updated.' : 'Task preset saved.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this task.')
    } finally { setSaving(false) }
  }

  async function deleteTask(task: TaskPreset) {
    if (!activeHome || !window.confirm(`Delete “${task.name}” from your saved tasks?`)) return
    setError('')
    setNotice('')
    try {
      await apiRequest<void>(`/homes/${activeHome.home_id}/task-presets/${task.preset_id}`, { method: 'DELETE' })
      setTasks((current) => current.filter((item) => item.preset_id !== task.preset_id))
      if (editing?.preset_id === task.preset_id) setEditing(null)
      setNotice('Task preset deleted.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete this task.')
    }
  }

  if (loading) return <LoadingState label="Loading saved appliances…" />
  return (
    <section className="tasks-page">
      <SectionTitle eyebrow="TASK LIBRARY" title="Appliances" description="Save the tasks you run often, then choose them when planning a day." action={<button type="button" className="primary-button" onClick={() => { setEditing(null); setError(''); document.getElementById('task-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }} disabled={!activeHome}><Plus size={15} />Add appliance</button>} />
      {!activeHome && <EmptyState title="Set up your home first" description="Your saved appliances belong to a home energy profile." action={<Link className="inline-link" to="/app/energy">Set up energy profile →</Link>} />}
      {error && <ErrorState message={error} onRetry={() => void loadTasks()} />}
      {notice && <div className="form-alert success-state" role="status">{notice}</div>}
      {activeHome && (tasks.length ? <div className="preset-list">
        {tasks.map((task) => <article className="preset-card surface" key={task.preset_id}>
          <span className="preset-icon"><WashingMachine size={18} /></span>
          <div className="preset-copy"><h3>{task.name}</h3><p>{task.power_kw} kW · {task.duration_minutes} min · {minuteLabel(task.earliest_start_minute)}–{minuteLabel(task.latest_finish_minute)}</p><span className={`priority-pill ${task.priority}`}>{priorities.find((item) => item.value === task.priority)?.label}</span></div>
          <div className="preset-actions"><button type="button" className="quiet-icon-button" aria-label={`Edit ${task.name}`} onClick={() => { setEditing(task); setError(''); document.getElementById('task-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }}><Pencil size={15} /></button><button type="button" className="quiet-icon-button danger-icon" aria-label={`Delete ${task.name}`} onClick={() => void deleteTask(task)}><Trash2 size={15} /></button></div>
        </article>)}
      </div> : <EmptyState title="No saved appliances yet" description="Add a task with its power, run time, allowed hours, and priority. It will be ready to add to a schedule." />)}
      {activeHome && <form id="task-form" className="task-form surface" key={editing?.preset_id ?? 'new-task'} onSubmit={saveTask}>
        <div className="form-card-heading"><div><p className="overline">{editing ? 'EDIT SAVED TASK' : 'NEW SAVED TASK'}</p><h2>{editing ? editing.name : 'Add an appliance'}</h2></div>{editing && <button className="quiet-icon-button" type="button" aria-label="Cancel editing" onClick={() => setEditing(null)}><X size={16} /></button>}</div>
        <div className="form-grid three-columns">
          <label className="span-two">Task name<input name="name" maxLength={120} placeholder="e.g. Dishwasher" defaultValue={editing?.name ?? ''} required /></label>
          <label>Power (kW)<input name="power_kw" type="number" min="0.01" step="0.01" defaultValue={editing?.power_kw ?? ''} required /></label>
          <label>Run time (minutes)<input name="duration_minutes" type="number" min="1" step="1" defaultValue={editing?.duration_minutes ?? ''} required /></label>
          <label>Earliest start<input name="earliest_start" type="time" defaultValue={editing ? minuteInputValue(editing.earliest_start_minute) : ''} required /></label>
          <label>Latest finish<input name="latest_finish" type="time" defaultValue={editing ? minuteInputValue(editing.latest_finish_minute) : ''} required /></label>
          <label>Priority<select name="priority" defaultValue={editing?.priority ?? 'prefer_solar'}>{priorities.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label>Maximum segments<input name="max_segments" type="number" min="1" max="1440" defaultValue={editing?.max_segments ?? 1} required /></label>
          <label>Minimum segment (minutes)<input name="minimum_segment_minutes" type="number" min="1" defaultValue={editing?.minimum_segment_minutes ?? ''} placeholder="Optional" /></label>
        </div>
        <div className="form-actions"><span><Clock3 size={14} /> Your allowed window must fit the task's run time.</span><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Save appliance'}</button></div>
      </form>}
    </section>
  )
}
