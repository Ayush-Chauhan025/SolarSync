import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { useHomes } from '../home/useHomes'
import { ErrorState } from './AsyncState'

export default function AppShell() {
  const location = useLocation()
  const { error: homeError, refresh } = useHomes()

  return (
    <div className="app-frame">
      <Sidebar />
      <div className="workspace">
        <Topbar />
        <main className="page-content" key={location.pathname}>{homeError ? <ErrorState message={homeError} onRetry={() => void refresh()} /> : <Outlet />}</main>
      </div>
    </div>
  )
}
