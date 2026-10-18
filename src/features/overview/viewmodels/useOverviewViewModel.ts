import { format, subMonths } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useRepositories } from '@/data/RepositoryProvider'
import { shouldShowBackupBanner } from '@/domain/backupReminder'
import { getCategory } from '@/domain/categories'
import { monthSpend, percentChange, spendByCategory, totalOwedToMe } from '@/domain/stats'
import type { CategoryId } from '@/domain/types'
import { formatVND } from '@/lib/format'
import { toTransactionListItem, type TransactionListItem } from '@/features/shared/viewmodels/transactionItems'
import { errorKey } from '@/features/shared/viewmodels/errors'
import { useBalances } from '@/features/shared/viewmodels/useBalances'
import { LAST_EXPORT_KEY, useExportBackup } from '@/features/shared/viewmodels/useExportBackup'
import { useFriends } from '@/features/shared/viewmodels/useFriends'
import { useRepoQuery } from '@/features/shared/viewmodels/useRepoQuery'

const RECENT_LIMIT = 5

/** Fixed categorical slots (validated palette in index.css: --series-1..8). */
const CATEGORY_SERIES: Partial<Record<CategoryId, number>> = {
  anuong: 1, dichuyen: 2, muasam: 3, hoadon: 4, giaitri: 5, suckhoe: 6, hoctap: 7,
}
const seriesColor = (c: CategoryId) => (CATEGORY_SERIES[c] ? `var(--series-${CATEGORY_SERIES[c]})` : 'var(--series-other)')

export interface DonutSlice {
  category: CategoryId
  icon: string
  value: number
  valueLabel: string
  /** CSS color, fixed per category (color follows the entity, never its rank). */
  color: string
}

export interface OverviewViewModel {
  state: {
    isLoading: boolean
    error: unknown
    isEmpty: boolean
    recent: TransactionListItem[]
    monthSpend: number
    monthSpendLabel: string
    /** null when last month had no spending. */
    changePercent: number | null
    owedToMe: number
    owedToMeLabel: string
    donut: DonutSlice[]
    showBackupBanner: boolean
  }
  actions: {
    openTransaction(id: string): void
    seeAll(): void
    goToDebts(): void
    exportBackup(): Promise<void>
  }
}

export function useOverviewViewModel(opts: { today?: Date } = {}): OverviewViewModel {
  const { t } = useTranslation()
  const { transactions, meta } = useRepositories()
  const exportBackup = useExportBackup()
  const navigate = useNavigate()
  const friends = useFriends()
  const balances = useBalances()
  const today = opts.today ?? new Date()
  const month = format(today, 'yyyy-MM')
  const previousMonth = format(subMonths(today, 1), 'yyyy-MM')

  const recent = useRepoQuery(() => transactions.listRecent(RECENT_LIMIT), [transactions])
  const months = useRepoQuery(
    async () => ({ current: await transactions.listByMonth(month), previous: await transactions.listByMonth(previousMonth) }),
    [transactions, month, previousMonth],
  )

  const backupInfo = useRepoQuery(
    async () => ({
      lastExportAt: await meta.get(LAST_EXPORT_KEY),
      syncEnabled: Boolean(await meta.get('syncSecret')),
      transactionCount: await transactions.count(),
    }),
    [meta, transactions],
  )

  const items = (recent.data ?? []).map((tx) => toTransactionListItem(tx, friends.names))
  const spend = monthSpend(months.data?.current ?? [])
  const owed = totalOwedToMe([...balances.byFriend.values()].map((l) => l.balance))

  return {
    state: {
      isLoading: recent.isLoading || months.isLoading || friends.isLoading || balances.isLoading || backupInfo.isLoading,
      error: recent.error ?? months.error ?? balances.error,
      isEmpty: items.length === 0,
      recent: items,
      monthSpend: spend,
      monthSpendLabel: formatVND(spend),
      changePercent: percentChange(spend, monthSpend(months.data?.previous ?? [])),
      owedToMe: owed,
      owedToMeLabel: formatVND(owed),
      donut: spendByCategory(months.data?.current ?? []).map((s) => ({
        category: s.category,
        icon: getCategory(s.category).icon,
        value: s.total,
        valueLabel: formatVND(s.total),
        color: seriesColor(s.category),
      })),
      showBackupBanner: backupInfo.data ? shouldShowBackupBanner({ ...backupInfo.data, now: today }) : false,
    },
    actions: {
      openTransaction: (id) => navigate(`/transactions?edit=${encodeURIComponent(id)}`),
      seeAll: () => navigate('/transactions'),
      goToDebts: () => navigate('/debts'),
      async exportBackup() {
        try {
          await exportBackup()
        } catch (e) {
          toast.error(t(errorKey(e)))
        }
      },
    },
  }
}
