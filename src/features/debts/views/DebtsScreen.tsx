import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Amount } from '@/components/Amount'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { ListSkeleton } from '@/components/ListSkeleton'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useDebtsViewModel } from '../viewmodels/useDebtsViewModel'

export function DebtsScreen() {
  const { t } = useTranslation()
  const { state, actions } = useDebtsViewModel()

  if (state.isLoading) return <ListSkeleton />
  if (state.error) return <ErrorState message={t('common.loadError')} />

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 p-4">
        <div className="rounded-xl border p-3">
          <p className="text-xs text-muted-foreground">{t('debts.owedToMe')}</p>
          <Amount label={state.totalOwedToMeLabel} className="text-lg font-semibold" tone="positive" />
        </div>
        {state.totalIOwe > 0 && (
          <div className="rounded-xl border p-3">
            <p className="text-xs text-muted-foreground">{t('debts.iOwe')}</p>
            <Amount label={state.totalIOweLabel} className="text-lg font-semibold" tone="negative" />
          </div>
        )}
      </div>

      {state.items.length === 0 ? (
        <EmptyState title={t('debts.empty')} hint={t('debts.emptyHint')} />
      ) : (
        <>
          <div className="flex gap-2 px-4 pb-2" role="radiogroup" aria-label={t('a11y.sort')}>
            {(['age', 'amount'] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                role="radio"
                aria-checked={state.sortBy === s}
                variant={state.sortBy === s ? 'default' : 'outline'}
                onClick={() => actions.setSortBy(s)}
              >
                {t(s === 'age' ? 'debts.sortAge' : 'debts.sortAmount')}
              </Button>
            ))}
          </div>
          <ul className="divide-y border-y">
            {state.items.map((item) => (
              <li key={item.friendId}>
                <button
                  type="button"
                  onClick={() => actions.openFriend(item.friendId)}
                  className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left active:bg-muted"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{item.name}</span>
                    {item.ageDays !== null && (
                      <span className={cn('text-xs', item.isOverdue ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                        {item.ageDays === 0 ? t('debts.oldestToday') : t('debts.oldest', { count: item.ageDays })}
                      </span>
                    )}
                  </span>
                  <Amount label={item.balanceLabel} tone={item.balance > 0 ? 'positive' : 'negative'} className="font-medium" />
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
