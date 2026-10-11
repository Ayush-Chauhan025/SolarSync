import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export type AuthValue = {
  session: Session | null
  user: User | null
  loading: boolean
  configured: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<boolean>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthValue | null>(null)
