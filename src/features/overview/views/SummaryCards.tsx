import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Amount } from '@/components/Amount'
import type { OverviewViewModel } from '../viewmodels/useOverviewViewModel'

export function SummaryCards({ vm }: { vm: OverviewViewModel }) {
  const { t } = useTranslation()
  const { state, actions } = vm
  const change = state.changePercent
  return (
    <div className="grid grid-cols-2 gap-2 px-4">
      <div className="flex min-w-0 flex-col gap-1 rounded-md border bg-card p-3 shadow-sm">
        <p className="text-xs text-muted-foreground">{t('overview.monthSpend')}</p>
        <Amount label={state.monthSpendLabel} className="text-xl font-semibold" />
        <p className="text-xs text-muted-foreground tabular-nums">
          {change === null
            ? t('overview.noComparison')
            : t('overview.vsLastMonth', { value: `${change > 0 ? '+' : change < 0 ? '−' : ''}${Math.abs(change)}%` })}
        </p>
      </div>
      <button
        type="button"
        onClick={actions.goToDebts}
        className="flex min-w-0 flex-col gap-1 rounded-md border bg-card p-3 text-left shadow-sm active:translate-y-px"
      >
        <span className="flex items-center justify-between text-xs text-muted-foreground">
          {t('overview.owedToMeHint')}
          <ChevronRight className="size-4" aria-hidden />
        </span>
        <Amount label={state.owedToMeLabel} className="text-xl font-semibold" tone="positive" />
        <span className="truncate text-xs text-muted-foreground">{t('overview.owedToMe', { amount: state.owedToMeLabel })}</span>
      </button>
    </div>
  )
}
