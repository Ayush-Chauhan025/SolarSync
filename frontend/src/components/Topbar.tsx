import { useLocation } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { useHomes } from '../home/useHomes'

const pageNames: Record<string, string> = {
  '/app': 'Overview',
  '/app/schedule': 'Schedule',
  '/app/tasks': 'Appliances',
  '/app/energy': 'Energy profile',
  '/app/notifications': 'Notifications',
}

export default function Topbar() {
  const { pathname } = useLocation()
  const { homes, activeHome, selectHome } = useHomes()
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [signOutError, setSignOutError] = useState('')
  const homeLabel = activeHome ? `${activeHome.settings.location.latitude.toFixed(2)}, ${activeHome.settings.location.longitude.toFixed(2)}` : 'Set up home'

  async function handleSignOut() {
    setSignOutError('')
    try { await signOut(); navigate('/login', { replace: true }) }
    catch (cause) { setSignOutError(cause instanceof Error ? cause.message : 'Could not sign out.') }
  }

  return (
    <header className="topbar">
      <div className="breadcrumb"><span>SolarSync</span><span className="crumb-slash">/</span><strong>{pageNames[pathname] ?? 'Overview'}</strong></div>
      <div className="topbar-actions"><label className="home-select"><span className="small-home-dot" />{homes.length > 1 ? <select aria-label="Select home" value={activeHome?.home_id ?? ''} onChange={(event) => selectHome(event.target.value)}>{homes.map((home) => <option key={home.home_id} value={home.home_id}>{home.settings.location.timezone} · {home.settings.location.latitude.toFixed(2)}, {home.settings.location.longitude.toFixed(2)}</option>)}</select> : <span>{homeLabel}</span>}</label><button type="button" className="topbar-logout" onClick={() => void handleSignOut()} aria-label="Sign out" title="Sign out"><LogOut size={15} /></button>{signOutError && <span className="topbar-error" role="alert">{signOutError}</span>}</div>
    </header>
  )
}
