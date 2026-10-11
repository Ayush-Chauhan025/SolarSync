import { supabase } from './supabase'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '')

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!API_BASE_URL) throw new Error('The API URL is not configured. Set VITE_API_BASE_URL and restart the frontend.')
  if (!supabase) throw new Error('Authentication is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')

  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw new Error('Could not restore your sign-in. Sign in again and retry.')
  if (!session?.access_token) {
    await supabase.auth.signOut({ scope: 'local' })
    throw new ApiError('Your session has expired. Please sign in again.', 401)
  }

  const headers = new Headers(options.headers)
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const send = (token: string) => {
    const requestHeaders = new Headers(headers)
    requestHeaders.set('Authorization', `Bearer ${token}`)
    return fetch(`${API_BASE_URL.replace(/\/$/, '')}${path}`, { ...options, headers: requestHeaders })
  }

  let response: Response
  try {
    response = await send(session.access_token)
  } catch {
    throw new Error('Could not reach SolarSync. Check your connection and try again.')
  }

  if (response.status === 401) {
    try {
      const { data, error } = await supabase.auth.refreshSession({ refresh_token: session.refresh_token })
      if (error || !data.session) {
        await supabase.auth.signOut({ scope: 'local' })
        throw new ApiError('Your session expired. Please sign in again.', 401)
      }
      response = await send(data.session.access_token)
    } catch (cause) {
      if (cause instanceof ApiError) throw cause
      throw new Error('Could not refresh your sign-in. Check your connection and try again.')
    }
  }

  if (response.status === 204) return undefined as T
  const contentType = response.headers.get('content-type') ?? ''
  let payload: unknown
  try { payload = contentType.includes('application/json') ? await response.json() : await response.text() }
  catch { payload = 'The server returned an unreadable response.' }
  if (!response.ok) {
    const detail = typeof payload === 'object' && payload !== null && 'detail' in payload
      ? (payload as { detail: unknown }).detail
      : null
    const message = typeof detail === 'string'
      ? detail
      : Array.isArray(detail)
        ? detail.map((item) => typeof item === 'object' && item !== null && 'msg' in item ? String(item.msg) : 'Invalid input').join('. ')
        : `Request failed (${response.status}). Please try again.`
    throw new ApiError(message, response.status)
  }
  return payload as T
}

export function apiBaseUrl() {
  return API_BASE_URL
}
