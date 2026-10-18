import { ChevronLeft, Send } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { Amount } from '@/components/Amount'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { ListSkeleton } from '@/components/ListSkeleton'
import { Button } from '@/components/ui/button'
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

      <h3 className="px-4 pb-1 text-sm font-semibold text-muted-foreground uppercase">{t('debts.timeline')}</h3>
      <ul className="divide-y border-y">
        {state.timeline.map((e) => (
          <li key={e.id} className="flex min-h-12 items-center gap-3 px-4 py-2">
            <span className="w-12 shrink-0 text-sm text-muted-foreground tabular-nums">{e.dateLabel}</span>
            <span className="min-w-0 flex-1 truncate">{e.kind === 'debt' ? e.note : e.note || t('debts.settlementItem')}</span>
            <Amount label={e.kind === 'debt' ? e.amountLabel : `−${e.amountLabel}`} tone={e.kind === 'settlement' ? 'positive' : undefined} />
          </li>
        ))}
      </ul>

      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-md gap-2 p-3">
          <Button variant="outline" className="flex-1" onClick={() => void actions.remind()} disabled={state.outstanding.length === 0}>
            <Send /> {t('debts.remind')}
          </Button>
          <Button className="flex-1" onClick={actions.openSettle} disabled={state.balance <= 0}>
            {t('debts.settle')}
          </Button>
        </div>
      </div>
      <SettleDrawer vm={vm} />
    </div>
  )
}
