import { createContext } from 'react'
import type { HomeItem } from '../types'

export type HomeValue = {
  homes: HomeItem[]
  activeHome: HomeItem | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  selectHome: (homeId: string) => void
  addHome: (home: HomeItem) => void
  updateHome: (home: HomeItem) => void
}

export const HomeContext = createContext<HomeValue | null>(null)
