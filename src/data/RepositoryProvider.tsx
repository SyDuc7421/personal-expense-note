import { createContext, useContext, type ReactNode } from 'react'
import type { Repositories } from './repositories/types'

const RepositoryContext = createContext<Repositories | null>(null)

export function RepositoryProvider({ value, children }: { value: Repositories; children: ReactNode }) {
  return <RepositoryContext.Provider value={value}>{children}</RepositoryContext.Provider>
}

export function useRepositories(): Repositories {
  const repos = useContext(RepositoryContext)
  if (!repos) throw new Error('useRepositories must be used inside RepositoryProvider')
  return repos
}
