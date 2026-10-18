import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import type { CategoryId, TransactionType } from '@/domain/types'
import type { TransactionListViewModel } from '../viewmodels/useTransactionListViewModel'

export function TransactionFilters({ vm }: { vm: TransactionListViewModel }) {
  const { t } = useTranslation()
  const { state, actions } = vm
  return (
    <div className="flex flex-col gap-2 border-b px-4 py-3">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" aria-label="previous month" onClick={actions.previousMonth}>
          <ChevronLeft />
        </Button>
        <span className="font-medium capitalize">{state.monthLabel}</span>
        <Button variant="ghost" size="icon" aria-label="next month" onClick={actions.nextMonth}>
          <ChevronRight />
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <NativeSelect
          aria-label={t('transactions.filterCategory')}
          value={state.filters.category ?? ''}
          onChange={(e) => actions.setFilter({ category: (e.target.value || undefined) as CategoryId | undefined })}
        >
          <option value="">{t('transactions.filterCategory')}</option>
          {state.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {t(`categories.${c.id}`)}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label={t('transactions.filterType')}
          value={state.filters.type ?? ''}
          onChange={(e) => actions.setFilter({ type: (e.target.value || undefined) as TransactionType | undefined })}
        >
          <option value="">{t('transactions.filterType')}</option>
          <option value="expense">{t('types.expense')}</option>
          <option value="income">{t('types.income')}</option>
        </NativeSelect>
        <Button
          variant={state.filters.hasDebts ? 'default' : 'outline'}
          aria-pressed={Boolean(state.filters.hasDebts)}
          className="truncate px-2"
          onClick={() => actions.setFilter({ hasDebts: state.filters.hasDebts ? undefined : true })}
        >
          <span className="truncate">{t('transactions.filterHasDebts')}</span>
        </Button>
      </div>
    </div>
  )
}
