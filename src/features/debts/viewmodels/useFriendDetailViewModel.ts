import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useRepositories } from '@/data/RepositoryProvider'
import { fifoOutstanding } from '@/domain/balance'
import { buildReminder } from '@/domain/reminder'
import { formatAmountInput, parseAmountInput } from '@/lib/amountInput'
import { formatShortDate, formatVND, todayISO } from '@/lib/format'
import { shareText } from '@/lib/share'
import { errorKey } from '@/features/shared/viewmodels/errors'
import { useBalances } from '@/features/shared/viewmodels/useBalances'
import { useReminderTemplate } from '@/features/shared/viewmodels/useReminderTemplate'
import { useRepoQuery } from '@/features/shared/viewmodels/useRepoQuery'

export interface TimelineEntry {
  id: string
  kind: 'debt' | 'settlement'
  date: string
  dateLabel: string
  note: string
  amountLabel: string
}

export interface OutstandingItem {
  date: string
  note: string
  remaining: number
}

export interface FriendDetailViewModel {
  state: {
    isLoading: boolean
    notFound: boolean
    error: unknown
    name: string
    balance: number
    balanceLabel: string
    timeline: TimelineEntry[]
    /** Debts not yet covered by settlements (FIFO), oldest first. */
    outstanding: OutstandingItem[]
    settle: { open: boolean; amount: string; error: string | null; isSaving: boolean }
  }
  actions: {
    back(): void
    openSettle(): void
    setSettleAmount(amount: string): void
    confirmSettle(): Promise<void>
    closeSettle(): void
    /** Shares (or copies) a gentle reminder listing the unpaid debts. */
    remind(): Promise<void>
  }
}

export function useFriendDetailViewModel(friendId: string, opts: { today?: Date } = {}): FriendDetailViewModel {
  const { t } = useTranslation()
  const { friends, ledger } = useRepositories()
  const reminder = useReminderTemplate()
  const navigate = useNavigate()
  const friend = useRepoQuery(async () => (await friends.get(friendId)) ?? null, [friends, friendId])
  const balances = useBalances(friendId)
  const [settle, setSettle] = useState({ open: false, amount: '', error: null as string | null, isSaving: false })

  const l = balances.byFriend.get(friendId)
  const balance = l?.balance ?? 0

  const { timeline, outstanding } = useMemo(() => {
    const entries = l?.entries ?? []
    const settlements = l?.settlements ?? []
    const items: (TimelineEntry & { sortKey: string })[] = [
      ...entries.map((e) => ({
        id: e.debtId, kind: 'debt' as const, date: e.date, dateLabel: formatShortDate(e.date), note: e.note,
        amountLabel: formatVND(e.amount), sortKey: `${e.date}|1|${e.debtId}`,
      })),
      ...settlements.map((s) => ({
        id: s.id, kind: 'settlement' as const, date: s.date, dateLabel: formatShortDate(s.date), note: s.note,
        amountLabel: formatVND(s.amount), sortKey: `${s.date}|2|${s.createdAt}`,
      })),
    ]
    items.sort((a, b) => b.sortKey.localeCompare(a.sortKey))
    const settled = settlements.reduce((acc, s) => acc + s.amount, 0)
    return {
      timeline: items.map(({ sortKey: _sortKey, ...rest }) => rest),
      outstanding: fifoOutstanding(entries, settled).map((o) => ({ date: o.date, note: o.note, remaining: o.remaining })),
    }
  }, [l])

  return {
    state: {
      isLoading: friend.isLoading || balances.isLoading || reminder.isLoading,
      notFound: !friend.isLoading && !friend.data,
      error: friend.error ?? balances.error,
      name: friend.data?.name ?? '',
      balance,
      balanceLabel: formatVND(balance),
      timeline,
      outstanding,
      settle,
    },
    actions: {
      back: () => navigate('/debts'),
      openSettle: () => setSettle({ open: true, amount: balance > 0 ? formatAmountInput(String(balance)) : '', error: null, isSaving: false }),
      setSettleAmount: (amount) => setSettle((s) => ({ ...s, amount, error: null })),
      closeSettle: () => setSettle((s) => ({ ...s, open: false })),
      async remind() {
        const text = buildReminder(reminder.template, friend.data?.name ?? '', outstanding)
        try {
          if ((await shareText(text)) === 'copied') toast.success(t('debts.reminderCopied'))
        } catch {
          toast.error(t('errors.unknown'))
        }
      },
      async confirmSettle() {
        const amount = parseAmountInput(settle.amount)
        if (!(amount > 0)) return setSettle((s) => ({ ...s, error: 'errors.invalidAmount' }))
        setSettle((s) => ({ ...s, isSaving: true }))
        try {
          await ledger.addSettlement({ friendId, amount, date: todayISO(opts.today), note: '' })
          setSettle({ open: false, amount: '', error: null, isSaving: false })
        } catch (e) {
          setSettle((s) => ({ ...s, error: errorKey(e), isSaving: false }))
        }
      },
    },
  }
}
