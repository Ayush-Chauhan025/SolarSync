import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../auth/useAuth'
import { apiRequest } from '../lib/api'
import type { HomeItem } from '../types'
import { HomeContext } from './home-context'

function storedHomeId(key: string) {
  try { return window.localStorage.getItem(key) ?? '' } catch { return '' }
}

function storeHomeId(key: string, value: string | null) {
  try {
    if (value) window.localStorage.setItem(key, value)
    else window.localStorage.removeItem(key)
  } catch { /* In-memory selection remains available when storage is disabled. */ }
}

export function HomeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [homes, setHomes] = useState<HomeItem[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!user) {
      setHomes([])
      setSelectedId('')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await apiRequest<{ homes: HomeItem[] }>('/homes')
      setHomes(result.homes)
      const storageKey = `solarsync:active-home:${user.id}`
      const storedId = storedHomeId(storageKey)
      const preferredId = result.homes.some((home) => home.home_id === storedId) ? storedId : result.homes[0]?.home_id ?? ''
      setSelectedId(preferredId)
      storeHomeId(storageKey, preferredId || null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load your homes.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { void refresh() }, [refresh])

  const selectHome = useCallback((homeId: string) => {
    setSelectedId(homeId)
    if (user) storeHomeId(`solarsync:active-home:${user.id}`, homeId)
  }, [user])

  const addHome = useCallback((home: HomeItem) => {
    setHomes((current) => [...current, home])
    selectHome(home.home_id)
  }, [selectHome])

  const updateHome = useCallback((updated: HomeItem) => {
    setHomes((current) => current.map((home) => home.home_id === updated.home_id ? updated : home))
  }, [])

  const activeHome = homes.find((home) => home.home_id === selectedId) ?? homes[0] ?? null
  const value = useMemo(() => ({ homes, activeHome, loading, error, refresh, selectHome, addHome, updateHome }), [homes, activeHome, loading, error, refresh, selectHome, addHome, updateHome])
  return <HomeContext.Provider value={value}>{children}</HomeContext.Provider>
}
