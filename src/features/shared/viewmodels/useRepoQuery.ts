import { useLiveQuery } from 'dexie-react-hooks'

export interface RepoQuery<T> {
  isLoading: boolean
  data: T | undefined
  error: unknown
}

/** useLiveQuery that reports loading/error instead of throwing during render. */
export function useRepoQuery<T>(query: () => Promise<T>, deps: unknown[]): RepoQuery<T> {
  const result = useLiveQuery(async (): Promise<{ data: T } | { error: unknown }> => {
    try {
      return { data: await query() }
    } catch (error) {
      return { error }
    }
  }, deps)
  return {
    isLoading: result === undefined,
    data: result && 'data' in result ? result.data : undefined,
    error: result && 'error' in result ? result.error : undefined,
  }
}
