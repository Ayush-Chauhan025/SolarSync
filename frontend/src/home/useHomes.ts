import { useContext } from 'react'
import { HomeContext } from './home-context'

export function useHomes() {
  const value = useContext(HomeContext)
  if (!value) throw new Error('useHomes must be used inside HomeProvider')
  return value
}
