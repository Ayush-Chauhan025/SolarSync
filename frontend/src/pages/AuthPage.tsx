import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, Eye, EyeOff, Sun } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import SolarWordmark from '../components/SolarWordmark'

type Props = { mode: 'login' | 'signup' }

export default function AuthPage({ mode }: Props) {
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const isSignup = mode === 'signup'
  const { signIn, signUp, configured } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    setSubmitting(true)
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password') ?? '')
    try {
      if (isSignup) {
        const confirmationRequired = await signUp(email, password)
        if (confirmationRequired) setNotice('Account created. Check your inbox to confirm your email, then sign in.')
        else navigate('/app', { replace: true })
      } else {
        await signIn(email, password)
        navigate('/app', { replace: true })
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Authentication failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <aside className="auth-aside">
        <Link className="marketing-brand auth-brand" to="/" aria-label="SolarSync home"><SolarWordmark /></Link>
        <div className="auth-aside-copy">
          <p className="marketing-kicker"><span /> HOME ENERGY PLANNING</p>
          <h1>Make room for the sun in your daily routine.</h1>
          <p>Plan flexible home tasks around your own solar forecast and energy needs.</p>
        </div>
        <div className="auth-aside-bottom"><span className="aside-sun"><Sun size={20} /></span><span>Solar-aware scheduling<br /><small>Built around your home setup.</small></span></div>
        <div className="auth-decoration" aria-hidden="true"><i /><i /><i /><i /><i /></div>
      </aside>

      <section className="auth-main">
        <Link className="auth-back" to="/"><ArrowLeft size={15} />Back to SolarSync</Link>
        <div className="auth-form-wrap">
          <div className="auth-mobile-brand"><SolarWordmark /></div>
          <p className="auth-kicker">{isSignup ? 'GET STARTED' : 'WELCOME BACK'}</p>
          <h2>{isSignup ? 'Create your account' : 'Sign in to SolarSync'}</h2>
          <p className="auth-subtitle">{isSignup ? 'Start planning your home energy day by day.' : 'Pick up where you left off with your home energy plan.'}</p>

          {!configured && <div className="form-alert error-state" role="alert">Authentication is not configured. Set the frontend Supabase environment variables and restart the app.</div>}
          {error && <div className="form-alert error-state" role="alert">{error}</div>}
          {notice && <div className="form-alert success-state" role="status">{notice}</div>}
          <form className="auth-form" onSubmit={handleSubmit}>
            <label htmlFor="email">Email address</label>
            <input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
            <div className="password-label-row"><label htmlFor="password">Password</label>{!isSignup && <span className="form-hint">Use your account password</span>}</div>
            <div className="password-field">
              <input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={isSignup ? 'new-password' : 'current-password'} placeholder={isSignup ? 'At least 8 characters' : 'Enter your password'} minLength={8} required />
              <button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </div>
            {isSignup && <p className="password-note">Use at least 8 characters.</p>}
            <button className="auth-submit" type="submit" disabled={submitting || !configured}>{submitting ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}</button>
          </form>

          <p className="auth-switch">{isSignup ? 'Already have an account?' : 'New to SolarSync?'} <Link to={isSignup ? '/login' : '/signup'}>{isSignup ? 'Sign in' : 'Create an account'}</Link></p>
        </div>
        <footer className="auth-footer"><span>SolarSync · Home energy planner</span><span>Secure sign-in</span></footer>
      </section>
    </main>
  )
}
