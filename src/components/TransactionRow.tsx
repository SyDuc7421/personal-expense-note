import { useTranslation } from 'react-i18next'
import { Amount } from './Amount'
import { Badge } from './ui/badge'

export interface TransactionRowData {
  id: string
  note: string
  categoryId: string
  categoryIcon: string
  type: 'expense' | 'income'
  amountLabel: string
  debtorNames: string[]
  needsReview?: boolean
}

export function TransactionRow({ item, onClick }: { item: TransactionRowData; onClick?: () => void }) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left active:bg-muted"
    >
      <span className="text-xl" aria-hidden>
        {item.categoryIcon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{item.note || t(`categories.${item.categoryId}`)}</span>
        {item.debtorNames.length > 0 && (
          <span className="truncate text-xs text-amber-700 dark:text-amber-400">
            {t('transactions.paidFor', { names: item.debtorNames.join(', ') })}
          </span>
        )}
        {item.needsReview && (
          <Badge variant="destructive" className="mt-0.5">
            {t('transactions.needsReview')}
          </Badge>
        )}
      </span>
      <Amount label={item.amountLabel} tone={item.type === 'income' ? 'positive' : undefined} className="font-medium" />
    </button>
  )
}
