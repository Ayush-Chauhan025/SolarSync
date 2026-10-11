import { AlertTriangle, LoaderCircle, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'

export function LoadingState({ label = 'Loading your home…' }: { label?: string }) {
  return <div className="async-state loading-state" role="status"><LoaderCircle size={19} className="loading-spinner" /><span>{label}</span></div>
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="async-state error-state" role="alert"><AlertTriangle size={18} /><div><strong>We couldn’t load this.</strong><p>{message}</p>{onRetry && <button type="button" className="secondary-button" onClick={onRetry}><RefreshCw size={14} />Try again</button>}</div></div>
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="async-state empty-state"><strong>{title}</strong><p>{description}</p>{action}</div>
}
