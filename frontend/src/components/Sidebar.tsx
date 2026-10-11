import { useState } from 'react'
import { Bell, CalendarDays, House, LayoutDashboard, Settings2, WashingMachine } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { useHomes } from '../home/useHomes'
import SolarWordmark from './SolarWordmark'

const mainLinks = [
  { label: 'Overview', path: '/app', icon: LayoutDashboard },
  { label: 'Schedule', path: '/app/schedule', icon: CalendarDays },
  { label: 'Appliances', path: '/app/tasks', icon: WashingMachine },
]

export default function Sidebar() {
  const { user, signOut } = useAuth()
  const { activeHome } = useHomes()
  const navigate = useNavigate()
  const [signOutError, setSignOutError] = useState('')

  async function handleSignOut() {
    setSignOutError('')
    try { await signOut(); navigate('/login', { replace: true }) }
    catch (cause) { setSignOutError(cause instanceof Error ? cause.message : 'Could not sign out.') }
  }

  return (
    <aside className="sidebar">
      <NavLink className="brand" to="/app" aria-label="SolarSync overview">
        <SolarWordmark />
      </NavLink>

      <div className="home-switcher">
        <span className="home-avatar"><House size={16} /></span>
        <span className="home-switcher-copy"><strong>{activeHome ? activeHome.settings.location.timezone : 'Home not set up'}</strong><small>{activeHome ? `${activeHome.settings.solar_system.rated_capacity_kwp} kWp solar` : 'Energy profile needed'}</small></span>
        <Settings2 size={15} className="muted-icon" />
      </div>

      <p className="nav-caption">PLAN</p>
      <nav className="nav-list" aria-label="Main navigation">
        {mainLinks.map(({ label, path, icon: Icon }) => (
          <NavLink key={path} to={path} end={path === '/app'} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <p className="nav-caption settings-caption">SETTINGS</p>
      <nav className="nav-list" aria-label="Home settings">
        <NavLink to="/app/energy" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          <Settings2 size={17} strokeWidth={1.8} /><span>Energy profile</span>
        </NavLink>
        <NavLink to="/app/notifications" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          <Bell size={17} strokeWidth={1.8} /><span>Notifications</span>
        </NavLink>
      </nav>

      <div className="sidebar-bottom">
        <span className="account-email" title={user?.email ?? ''}>{user?.email}</span>
        <button type="button" className="sign-out-button" onClick={() => void handleSignOut()}>Sign out</button>
      </div>
      {signOutError && <span className="sidebar-error" role="alert">{signOutError}</span>}
    </aside>
  )
}
