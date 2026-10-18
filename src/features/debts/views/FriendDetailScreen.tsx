import { Check, ChevronLeft, Send } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { Amount } from '@/components/Amount'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { ListSkeleton } from '@/components/ListSkeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useFriendDetailViewModel } from '../viewmodels/useFriendDetailViewModel'
import { SettleDrawer } from './SettleDrawer'

export function FriendDetailScreen() {
  const { friendId = '' } = useParams()
  return <FriendDetail key={friendId} friendId={friendId} />
}

function FriendDetail({ friendId }: { friendId: string }) {
  const { t } = useTranslation()
  const vm = useFriendDetailViewModel(friendId)
  const { state, actions } = vm

  if (state.isLoading) return <ListSkeleton />
  if (state.error) return <ErrorState message={t('common.loadError')} />
  if (state.notFound) return <EmptyState title={t('debts.notFound')} />
  const count = state.selection.ids.length

  return (
    <div className="pb-20">
      <div className="flex items-center gap-1 px-2 pt-2">
        <Button variant="ghost" size="icon" aria-label={t('debts.back')} onClick={actions.back}>
          <ChevronLeft />
        </Button>
        <h2 className="truncate text-lg font-semibold">{state.name}</h2>
      </div>
      <div className="px-4 pb-4">
        <p className="text-sm text-muted-foreground">
          {state.balance > 0 ? t('debts.theyOweYou') : state.balance < 0 ? t('debts.youOweThem') : t('debts.allSettled')}
        </p>
        <Amount
          label={state.balanceLabel}
          tone={state.balance > 0 ? 'positive' : state.balance < 0 ? 'negative' : 'muted'}
          className="text-3xl font-bold"
        />
      </div>

      <div className="flex min-h-11 items-center justify-between pr-2 pl-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase">{t('debts.timeline')}</h3>
        {(state.canSelect || state.selection.active) && (
          <Button variant="ghost" size="sm" onClick={actions.toggleSelectMode}>
            {state.selection.active ? t('debts.done') : t('debts.select')}
          </Button>
        )}
      </div>
      <ul className="divide-y border-y">
        {state.timeline.map((e) => {
          const checkable = state.selection.active && e.selectable
          const checked = checkable && state.selection.ids.includes(e.id)
          return (
            <li
              key={e.id}
              className={cn('relative flex min-h-12 items-center gap-3 px-4 py-2', e.status === 'paid' && 'text-muted-foreground', checked && 'bg-primary/10')}
            >
              {state.selection.active && !checkable && <span className="w-5 shrink-0" />}
              {checkable && (
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  aria-label={t('debts.selectItem', { note: e.note || e.dateLabel })}
                  onClick={() => actions.toggleSelected(e.id)}
                  className="-mx-3 flex size-11 shrink-0 items-center justify-center after:absolute after:inset-0"
                >
                  <span
                    className={cn(
                      'flex size-5 items-center justify-center rounded border-2 border-primary',
                      checked && 'bg-primary text-primary-foreground',
                    )}
                  >
                    {checked && <Check className="size-3.5" />}
                  </span>
                </button>
              )}
              <span className="w-12 shrink-0 text-sm text-muted-foreground tabular-nums">{e.dateLabel}</span>
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate">{e.kind === 'debt' ? e.note : e.note || t('debts.settlementItem')}</span>
                {e.status === 'paid' && <Badge variant="outline">{t('debts.paidBadge')}</Badge>}
                {e.remainingLabel && (
                  <span className="shrink-0 text-sm text-muted-foreground">{t('debts.remainingOf', { amount: e.remainingLabel })}</span>
                )}
              </span>
              <Amount
                label={e.kind === 'debt' ? e.amountLabel : `−${e.amountLabel}`}
                tone={e.kind === 'settlement' ? 'positive' : undefined}
                className={cn(e.status === 'paid' && 'line-through')}
              />
            </li>
          )
        })}
      </ul>

      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-md gap-2 p-3">
          {state.selection.active ? (
            <>
              <Button variant="outline" className="flex-1" onClick={() => void actions.remindSelected()} disabled={count === 0}>
                <Send /> {count ? t('debts.remindCount', { count }) : t('debts.remind')}
              </Button>
              <Button className="flex-1" onClick={() => void actions.markSelectedPaid()} disabled={count === 0 || state.isMarkingPaid}>
                {count ? t('debts.markPaidCount', { count }) : t('debts.settle')}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" className="flex-1" onClick={() => void actions.remind()} disabled={state.outstanding.length === 0}>
                <Send /> {t('debts.remind')}
              </Button>
              <Button className="flex-1" onClick={actions.openSettle} disabled={state.balance <= 0}>
                {t('debts.settle')}
              </Button>
            </>
          )}
        </div>
      </div>
      <SettleDrawer vm={vm} />
    </div>
  )
}
