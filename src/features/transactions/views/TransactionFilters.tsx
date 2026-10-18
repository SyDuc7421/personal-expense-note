import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { SheetSelect } from '@/components/ui/sheet-select'
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
        <SheetSelect
          label={t('transactions.filterCategory')}
          placeholder={t('transactions.filterCategory')}
          value={state.filters.category ?? ''}
          onValueChange={(v) => actions.setFilter({ category: (v || undefined) as CategoryId | undefined })}
          options={[
            { value: '', label: t('common.all') },
            ...state.categories.map((c) => ({ value: c.id, label: t(`categories.${c.id}`), icon: c.icon })),
          ]}
        />
        <SheetSelect
          label={t('transactions.filterType')}
          placeholder={t('transactions.filterType')}
          value={state.filters.type ?? ''}
          onValueChange={(v) => actions.setFilter({ type: (v || undefined) as TransactionType | undefined })}
          options={[
            { value: '', label: t('common.all') },
            { value: 'expense', label: t('types.expense') },
            { value: 'income', label: t('types.income') },
          ]}
        />
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
