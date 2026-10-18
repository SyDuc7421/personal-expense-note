import { useMemo } from 'react'
import { useRepositories } from '@/data/RepositoryProvider'
import type { Friend } from '@/domain/types'
import { useRepoQuery } from './useRepoQuery'

export interface FriendOption {
  id: string
  name: string
}

/** All live friends (archived included, for names) + selectable options (not archived). */
export function useFriends() {
  const { friends } = useRepositories()
  const query = useRepoQuery(() => friends.list({ includeArchived: true }), [friends])
  return useMemo(() => {
    const all: Friend[] = query.data ?? []
    return {
      isLoading: query.isLoading,
      all,
      names: new Map(all.map((f) => [f.id, f.name])),
      options: all.filter((f) => !f.archived).map((f): FriendOption => ({ id: f.id, name: f.name })),
    }
  }, [query.data, query.isLoading])
}
