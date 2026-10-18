import { useNavigate } from 'react-router'
import { useRepositories } from '@/data/RepositoryProvider'
import { toTransactionListItem, type TransactionListItem } from '@/features/shared/viewmodels/transactionItems'
import { useFriends } from '@/features/shared/viewmodels/useFriends'
import { useRepoQuery } from '@/features/shared/viewmodels/useRepoQuery'

const RECENT_LIMIT = 5

export interface OverviewViewModel {
  state: {
    isLoading: boolean
    error: unknown
    isEmpty: boolean
    recent: TransactionListItem[]
  }
  actions: {
    openTransaction(id: string): void
    seeAll(): void
  }
}

export function useOverviewViewModel(_opts: { today?: Date } = {}): OverviewViewModel {
  const { transactions } = useRepositories()
  const navigate = useNavigate()
  const friends = useFriends()
  const recent = useRepoQuery(() => transactions.listRecent(RECENT_LIMIT), [transactions])
  const items = (recent.data ?? []).map((tx) => toTransactionListItem(tx, friends.names))

  return {
    state: {
      isLoading: recent.isLoading || friends.isLoading,
      error: recent.error,
      isEmpty: items.length === 0,
      recent: items,
    },
    actions: {
      openTransaction: (id) => navigate(`/transactions?edit=${encodeURIComponent(id)}`),
      seeAll: () => navigate('/transactions'),
    },
  }
}
