import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { AuthContext } from './auth-context'
import type { AuthValue } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    let active = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) {
        setSession(nextSession)
        setLoading(false)
      }
    })
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      setSession(error ? null : data.session)
      setLoading(false)
    }).catch(() => {
      if (!active) return
      setSession(null)
      setLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthValue>(() => ({
    session,
    user: session?.user ?? null,
    loading,
    configured: supabaseConfigured,
    async signIn(email, password) {
      if (!supabase) throw new Error('Supabase is not configured. Set the frontend environment variables.')
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    },
    async signUp(email, password) {
      if (!supabase) throw new Error('Supabase is not configured. Set the frontend environment variables.')
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/login` },
      })
      if (error) throw error
      return !data.session
    },
    async signOut() {
      if (!supabase) return
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    },
  }), [session, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
