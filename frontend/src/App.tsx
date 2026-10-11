import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/useAuth'
import { LoadingState } from './components/AsyncState'
import { apiBaseUrl } from './lib/api'
import AppShell from './components/AppShell'
import { HomeProvider } from './home/HomeContext'

const AuthPage = lazy(() => import('./pages/AuthPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const HomePage = lazy(() => import('./pages/HomePage'))
const HowItWorksPage = lazy(() => import('./pages/HowItWorksPage'))
const EnergyPage = lazy(() => import('./pages/EnergyPage'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const SchedulePage = lazy(() => import('./pages/SchedulePage'))
const TasksPage = lazy(() => import('./pages/TasksPage'))

function ProtectedRoutes() {
  const { loading, user, configured } = useAuth()
  if (loading) return <LoadingState label="Restoring your session…" />
  if (!configured || !apiBaseUrl()) return <ConfigurationError />
  if (!user) return <Navigate to="/login" replace />
  return <HomeProvider><AppShell /></HomeProvider>
}

function PublicAuth({ mode }: { mode: 'login' | 'signup' }) {
  const { loading, user } = useAuth()
  if (loading) return <LoadingState label="Restoring your session…" />
  if (user) return <Navigate to="/app" replace />
  return <AuthPage mode={mode} />
}

function ConfigurationError() {
  return <main className="configuration-page"><section><h1>SolarSync needs configuration</h1><p>Set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and VITE_API_BASE_URL in the frontend environment, then restart the app.</p></section></main>
}

export default function App() {
  return (
    <Suspense fallback={<LoadingState label="Loading SolarSync…" />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/login" element={<PublicAuth mode="login" />} />
        <Route path="/signup" element={<PublicAuth mode="signup" />} />
        <Route path="/app" element={<ProtectedRoutes />}>
          <Route index element={<DashboardPage />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="energy" element={<EnergyPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
