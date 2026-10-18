import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useSyncStatus } from '@/features/shared/viewmodels/useSyncStatus'

const DOT = { synced: 'bg-emerald-500', offline: 'bg-muted-foreground/50', pending: 'bg-amber-500' } as const

export function SyncIndicator() {
  const { t } = useTranslation()
  const { indicator } = useSyncStatus()
  if (indicator === 'none') return null
  return (
    <span role="img" className="flex size-11 items-center justify-center" aria-label={t(`syncIndicator.${indicator}`)} title={t(`syncIndicator.${indicator}`)}>
      <span className={cn('size-2.5 rounded-full', DOT[indicator])} />
    </span>
  )
}
