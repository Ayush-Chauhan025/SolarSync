import { useCallback, useEffect, useState } from 'react'
import { Bell, Check, Clock3 } from 'lucide-react'
import SectionTitle from '../components/SectionTitle'
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncState'
import { useHomes } from '../home/useHomes'
import { apiRequest } from '../lib/api'
import type { NotificationItem } from '../types'

export default function NotificationsPage() {
  const { activeHome } = useHomes()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reading, setReading] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try { setItems(await apiRequest<NotificationItem[]>('/notifications')) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load notifications.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const timer = window.setInterval(() => {
      void apiRequest<NotificationItem[]>('/notifications').then(setItems).catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : 'Could not refresh notifications.')
      })
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [])

  async function markRead(id: string) {
    setReading(id)
    setError('')
    try {
      await apiRequest<NotificationItem>(`/notifications/${id}/read`, { method: 'POST' })
      setItems((current) => current.filter((item) => item.notification_id !== id))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not mark this notification as read.') }
    finally { setReading(null) }
  }

  if (loading) return <LoadingState label="Loading notifications…" />
  return <section className="notifications-page">
    <SectionTitle eyebrow="UPDATES" title="Notifications" description="Due reminders and changes to your saved schedule appear here." />
    {error && <ErrorState message={error} onRetry={() => void load()} />}
    {!activeHome ? <EmptyState title="Set up your home first" description="Notifications will be linked to your saved schedules." /> : items.length === 0 ? <EmptyState title="You're all caught up" description="There are no due, unread notifications right now." /> : <div className="notification-list">{items.map((item) => <article className="notification-card surface" key={item.notification_id}>
      <span className="notification-icon"><Bell size={17} /></span>
      <div className="notification-copy"><span className="overline">{item.kind === 'task_start' ? 'TASK REMINDER' : 'SCHEDULE CHANGE'}</span><h2>{item.title}</h2><p>{item.message}</p><small><Clock3 size={12} />{new Date(item.notify_at).toLocaleString()}</small></div>
      <button type="button" className="secondary-button" onClick={() => void markRead(item.notification_id)} disabled={reading === item.notification_id}>{reading === item.notification_id ? 'Saving…' : <><Check size={14} />Mark read</>}</button>
    </article>)}</div>}
  </section>
}
