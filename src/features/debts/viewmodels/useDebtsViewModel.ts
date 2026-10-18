import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { ageInDays, fifoOutstanding } from '@/domain/balance'
import { formatVND } from '@/lib/format'
import { useBalances } from '@/features/shared/viewmodels/useBalances'
import { useFriends } from '@/features/shared/viewmodels/useFriends'

export const OVERDUE_DAYS = 30

export type DebtSort = 'age' | 'amount'

export interface DebtListItem {
  friendId: string
  name: string
  balance: number
  balanceLabel: string
  /** Days since the oldest debt not yet covered by settlements (FIFO); null when nothing is owed to me. */
  ageDays: number | null
  isOverdue: boolean
}

export interface DebtsViewModel {
  state: {
    isLoading: boolean
    error: unknown
    totalOwedToMe: number
    totalOwedToMeLabel: string
    totalIOwe: number
    totalIOweLabel: string
    items: DebtListItem[]
    sortBy: DebtSort
  }
  actions: {
    setSortBy(s: DebtSort): void
    openFriend(friendId: string): void
  }
}

export function useDebtsViewModel(opts: { today?: Date } = {}): DebtsViewModel {
  const navigate = useNavigate()
  const friends = useFriends()
  const balances = useBalances()
  const [sortBy, setSortBy] = useState<DebtSort>('age')
  const today = opts.today ?? new Date()
  const todayKey = today.toDateString()

  const items = useMemo(() => {
    const now = new Date(todayKey)
    const list = [...balances.byFriend.entries()]
      .filter(([, l]) => l.balance !== 0)
      .map(([friendId, l]): DebtListItem => {
        const settled = l.settlements.reduce((acc, s) => acc + s.amount, 0)
        const oldest = fifoOutstanding(l.entries, settled)[0]
        const ageDays = l.balance > 0 && oldest ? ageInDays(oldest.date, now) : null
        return {
          friendId,
          name: friends.names.get(friendId) ?? '?',
          balance: l.balance,
          balanceLabel: formatVND(l.balance),
          ageDays,
          isOverdue: ageDays !== null && ageDays > OVERDUE_DAYS,
        }
      })
    const byName = (a: DebtListItem, b: DebtListItem) => a.name.localeCompare(b.name, 'vi')
    return list.sort(
      sortBy === 'age'
        ? (a, b) => (b.ageDays ?? -1) - (a.ageDays ?? -1) || byName(a, b)
        : (a, b) => b.balance - a.balance || byName(a, b),
    )
  }, [balances.byFriend, friends.names, sortBy, todayKey])

  const totalOwedToMe = items.reduce((acc, i) => acc + Math.max(i.balance, 0), 0)
  const totalIOwe = items.reduce((acc, i) => acc + Math.max(-i.balance, 0), 0)

  return {
    state: {
      isLoading: balances.isLoading || friends.isLoading,
      error: balances.error,
      totalOwedToMe,
      totalOwedToMeLabel: formatVND(totalOwedToMe),
      totalIOwe,
      totalIOweLabel: formatVND(totalIOwe),
      items,
      sortBy,
    },
    actions: {
      setSortBy,
      openFriend: (friendId) => navigate(`/debts/${friendId}`),
    },
  }
}
