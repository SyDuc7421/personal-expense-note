import { addMonths, format, isToday, isYesterday, parseISO } from 'date-fns'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { useRepositories } from '@/data/RepositoryProvider'
import { CATEGORIES } from '@/domain/categories'
import type { CategoryId, TransactionType } from '@/domain/types'
import { formatVND, monthOf, todayISO } from '@/lib/format'
import { useDateLocale } from '@/features/shared/viewmodels/useDateLocale'
import { useFriends } from '@/features/shared/viewmodels/useFriends'
import { useRepoQuery } from '@/features/shared/viewmodels/useRepoQuery'
import {
  expenseShare,
  toTransactionListItem,
  type CategoryOption,
  type TransactionListItem,
} from '@/features/shared/viewmodels/transactionItems'

export interface TransactionFilters {
  category?: CategoryId
  type?: TransactionType
  hasDebts?: boolean
}

export interface TransactionDayGroup {
  date: string
  /** Already localized (Today / Yesterday / weekday + dd/MM). */
  label: string
  totalLabel: string
  items: TransactionListItem[]
}

/** null = closed, 'new' = create form, otherwise the id being edited. */
export type FormTarget = null | 'new' | string

export interface TransactionListViewModel {
  state: {
    isLoading: boolean
    error: unknown
    month: string
    monthLabel: string
    filters: TransactionFilters
    groups: TransactionDayGroup[]
    categories: CategoryOption[]
    formTarget: FormTarget
  }
  actions: {
    previousMonth(): void
    nextMonth(): void
    setFilter(patch: Partial<TransactionFilters>): void
    openCreate(): void
    openEdit(id: string): void
    closeForm(): void
  }
}

/** `?edit=<id>` in the URL (from Overview) opens that transaction's edit form. */
export function useTransactionListViewModel(
  opts: { initialMonth?: string; initialEdit?: string } = {},
): TransactionListViewModel {
  const { transactions } = useRepositories()
  const locale = useDateLocale()
  const { t } = useTranslation()
  const [month, setMonth] = useState(opts.initialMonth ?? monthOf(todayISO()))
  const [filters, setFilters] = useState<TransactionFilters>({})
  const [params, setParams] = useSearchParams()
  const [formTarget, setFormTarget] = useState<FormTarget>(opts.initialEdit ?? params.get('edit'))
  const friends = useFriends()
  const query = useRepoQuery(() => transactions.listByMonth(month), [transactions, month])

  const groups = useMemo(() => {
    const txs = (query.data ?? []).filter(
      (tx) =>
        (!filters.category || tx.category === filters.category) &&
        (!filters.type || tx.type === filters.type) &&
        (filters.hasDebts === undefined || tx.debts.length > 0 === filters.hasDebts),
    )
    const byDate = new Map<string, typeof txs>()
    for (const tx of txs) byDate.set(tx.date, [...(byDate.get(tx.date) ?? []), tx])
    return [...byDate.entries()].map(([date, dayTxs]): TransactionDayGroup => {
      const d = parseISO(date)
      return {
        date,
        label: isToday(d) ? t('common.today') : isYesterday(d) ? t('common.yesterday') : format(d, 'EEEE, dd/MM', { locale }),
        totalLabel: formatVND(dayTxs.reduce((acc, tx) => acc + expenseShare(tx), 0)),
        items: dayTxs.map((tx) => toTransactionListItem(tx, friends.names)),
      }
    })
  }, [query.data, filters, friends.names, locale, t])

  const shift = (delta: number) => setMonth((m) => format(addMonths(parseISO(`${m}-01`), delta), 'yyyy-MM'))

  return {
    state: {
      isLoading: query.isLoading || friends.isLoading,
      error: query.error,
      month,
      monthLabel: format(parseISO(`${month}-01`), 'LLLL yyyy', { locale }),
      filters,
      groups,
      categories: CATEGORIES.map((c) => ({ id: c.id, icon: c.icon })),
      formTarget,
    },
    actions: {
      previousMonth: () => shift(-1),
      nextMonth: () => shift(1),
      setFilter: (patch) => setFilters((f) => ({ ...f, ...patch })),
      openCreate: () => setFormTarget('new'),
      openEdit: (id) => setFormTarget(id),
      closeForm() {
        setFormTarget(null)
        if (params.has('edit')) setParams({}, { replace: true })
      },
    },
  }
}
