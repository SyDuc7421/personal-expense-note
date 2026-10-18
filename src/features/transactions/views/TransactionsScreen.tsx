import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { ListSkeleton } from '@/components/ListSkeleton'
import { TransactionRow } from '@/components/TransactionRow'
import { Amount } from '@/components/Amount'
import { Button } from '@/components/ui/button'
import { useTransactionListViewModel } from '../viewmodels/useTransactionListViewModel'
import { TransactionFilters } from './TransactionFilters'
import { TransactionFormDrawer } from './TransactionFormDrawer'

export function TransactionsScreen() {
  const { t } = useTranslation()
  const vm = useTransactionListViewModel()
  const { state, actions } = vm

  return (
    <div>
      <TransactionFilters vm={vm} />
      {state.isLoading ? (
        <ListSkeleton />
      ) : state.error ? (
        <ErrorState message={t('common.loadError')} />
      ) : state.groups.length === 0 ? (
        <EmptyState title={t('transactions.empty')} hint={t('transactions.emptyHint')} />
      ) : (
        <ul>
          {state.groups.map((group) => (
            <li key={group.date}>
              <div className="flex items-center justify-between bg-muted/50 px-4 py-1.5 text-sm text-muted-foreground">
                <span>{group.label}</span>
                <Amount label={t('transactions.dayTotal', { amount: group.totalLabel })} />
              </div>
              <ul className="divide-y">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <TransactionRow item={item} onClick={() => actions.openEdit(item.id)} />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <Button
        size="icon-lg"
        aria-label={t('transactions.add')}
        className="fixed right-[max(1rem,calc(50%-14rem+1rem))] bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 size-14 rounded-full"
        onClick={actions.openCreate}
      >
        <Plus className="size-6" />
      </Button>

      {state.formTarget && (
        <TransactionFormDrawer
          key={state.formTarget}
          id={state.formTarget === 'new' ? undefined : state.formTarget}
          onClose={actions.closeForm}
        />
      )}
    </div>
  )
}
