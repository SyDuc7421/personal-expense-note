import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useRepositories } from '@/data/RepositoryProvider'
import { allocateSettlements } from '@/domain/balance'
import { buildReminder } from '@/domain/reminder'
import { parseAmountInput } from '@/lib/amountInput'
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
  /** Debts only. */
  status?: 'unpaid' | 'partial' | 'paid'
  /** Set only when status === 'partial'. */
  remainingLabel?: string
  /** Debt with something still owed. */
  selectable: boolean
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
    /** ids = selected debtIds */
    selection: { active: boolean; ids: string[] }
    canSelect: boolean
    isMarkingPaid: boolean
  }
  actions: {
    back(): void
    openSettle(): void
    setSettleAmount(amount: string): void
    confirmSettle(): Promise<void>
    closeSettle(): void
    /** Shares (or copies) a gentle reminder listing the unpaid debts. */
    remind(): Promise<void>
    /** Entering or leaving clears the selection. */
    toggleSelectMode(): void
    toggleSelected(debtId: string): void
    /** Reminds about the selected debts only; stays in select mode. */
    remindSelected(): Promise<void>
    /** Records one settlement for the selected debts' remaining amounts, with an Undo toast. */
    markSelectedPaid(): Promise<void>
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
  const [selection, setSelection] = useState({ active: false, ids: [] as string[] })
  // A ref, not state: a double tap fires twice before React re-renders.
  const marking = useRef(false)
  const [isMarkingPaid, setIsMarkingPaid] = useState(false)

  const l = balances.byFriend.get(friendId)
  const balance = l?.balance ?? 0

  const { timeline, outstanding, allocation } = useMemo(() => {
    const allocation = allocateSettlements(l?.entries ?? [], l?.settlements ?? [])
    const byId = new Map(allocation.map((a) => [a.debtId, a]))
    const paidFor = (debtIds: string[]) =>
      allocation
        .filter((a) => debtIds.includes(a.debtId))
        .map((a) => a.note.trim() || formatShortDate(a.date))
        .join(', ')
    const items: (TimelineEntry & { sortKey: string })[] = [
      ...allocation.map((a) => ({
        id: a.debtId, kind: 'debt' as const, date: a.date, dateLabel: formatShortDate(a.date), note: a.note,
        amountLabel: formatVND(a.amount), sortKey: `${a.date}|1|${a.debtId}`,
        status: a.remaining === 0 ? ('paid' as const) : a.remaining < a.amount ? ('partial' as const) : ('unpaid' as const),
        remainingLabel: a.remaining > 0 && a.remaining < a.amount ? formatVND(a.remaining) : undefined,
        selectable: a.remaining > 0,
      })),
      ...(l?.settlements ?? []).map((s) => {
        const items = s.debtIds ? paidFor(s.debtIds) : ''
        return {
          id: s.id, kind: 'settlement' as const, date: s.date, dateLabel: formatShortDate(s.date),
          note: items ? t('debts.paidFor', { items }) : s.note,
          amountLabel: formatVND(s.amount), sortKey: `${s.date}|2|${s.createdAt}`, selectable: false,
        }
      }),
    ]
    items.sort((a, b) => b.sortKey.localeCompare(a.sortKey))
    return {
      allocation: byId,
      timeline: items.map(({ sortKey: _sortKey, ...rest }) => rest),
      outstanding: allocation.filter((a) => a.remaining > 0).map((o) => ({ date: o.date, note: o.note, remaining: o.remaining })),
    }
  }, [l, t])

  const selected = selection.ids.flatMap((id) => allocation.get(id) ?? [])
  const share = async (items: OutstandingItem[]) => {
    const text = buildReminder(reminder.template, friend.data?.name ?? '', items)
    try {
      if ((await shareText(text)) === 'copied') toast.success(t('debts.reminderCopied'))
    } catch {
      toast.error(t('errors.unknown'))
    }
  }

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
      selection,
      canSelect: outstanding.length > 0,
      isMarkingPaid,
    },
    actions: {
      back: () => navigate('/debts'),
      openSettle: () => setSettle({ open: true, amount: balance > 0 ? String(balance) : '', error: null, isSaving: false }),
      setSettleAmount: (amount) => setSettle((s) => ({ ...s, amount, error: null })),
      closeSettle: () => setSettle((s) => ({ ...s, open: false })),
      remind: () => share(outstanding),
      toggleSelectMode: () => setSelection((s) => ({ active: !s.active, ids: [] })),
      toggleSelected(debtId) {
        if (!((allocation.get(debtId)?.remaining ?? 0) > 0)) return
        setSelection((s) => ({ ...s, ids: s.ids.includes(debtId) ? s.ids.filter((id) => id !== debtId) : [...s.ids, debtId] }))
      },
      remindSelected: () => share(selected.filter((a) => a.remaining > 0)),
      async markSelectedPaid() {
        const debts = selected.filter((a) => a.remaining > 0)
        if (debts.length === 0 || marking.current) return
        marking.current = true
        setIsMarkingPaid(true)
        try {
          const id = await ledger.addSettlement({
            friendId, amount: debts.reduce((acc, a) => acc + a.remaining, 0), date: todayISO(opts.today), note: '',
            debtIds: debts.map((a) => a.debtId),
          })
          setSelection({ active: false, ids: [] })
          toast.success(t('debts.markedPaid', { count: debts.length }), {
            duration: 5000,
            action: { label: t('debts.undo'), onClick: () => void ledger.removeSettlement(id) },
          })
        } catch (e) {
          toast.error(t(errorKey(e)))
        } finally {
          marking.current = false
          setIsMarkingPaid(false)
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
