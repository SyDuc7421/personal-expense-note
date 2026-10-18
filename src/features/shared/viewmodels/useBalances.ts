import { useMemo } from 'react'
import { useRepositories } from '@/data/RepositoryProvider'
import type { FriendDebtEntry } from '@/data/repositories/types'
import { friendBalance } from '@/domain/balance'
import type { Settlement } from '@/domain/types'
import { useRepoQuery } from './useRepoQuery'

export interface FriendLedger {
  balance: number
  entries: FriendDebtEntry[]
  settlements: Settlement[]
}

/** Live ledger for every friend (or one friend), keyed by friendId. */
export function useBalances(friendId?: string) {
  const { ledger } = useRepositories()
  const query = useRepoQuery(
    async () => ({ entries: await ledger.listDebtEntries(friendId), settlements: await ledger.listSettlements(friendId) }),
    [ledger, friendId],
  )
  const byFriend = useMemo(() => {
    const map = new Map<string, FriendLedger>()
    const get = (id: string) => {
      let l = map.get(id)
      if (!l) map.set(id, (l = { balance: 0, entries: [], settlements: [] }))
      return l
    }
    for (const e of query.data?.entries ?? []) get(e.friendId).entries.push(e)
    for (const s of query.data?.settlements ?? []) get(s.friendId).settlements.push(s)
    for (const l of map.values()) {
      l.balance = friendBalance(l.entries, l.settlements)
    }
    return map
  }, [query.data])
  return { isLoading: query.isLoading, error: query.error, byFriend }
}
