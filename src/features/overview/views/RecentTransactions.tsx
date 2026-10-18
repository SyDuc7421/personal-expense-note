import { useTranslation } from 'react-i18next'
import { TransactionRow } from '@/components/TransactionRow'
import { Button } from '@/components/ui/button'
import type { OverviewViewModel } from '../viewmodels/useOverviewViewModel'

export function RecentTransactions({ vm }: { vm: OverviewViewModel }) {
  const { t } = useTranslation()
  return (
    <section>
      <div className="flex items-center justify-between px-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase">{t('overview.recent')}</h2>
        <Button variant="link" className="px-0" onClick={vm.actions.seeAll}>
          {t('overview.seeAll')}
        </Button>
      </div>
      <ul className="divide-y border-y">
        {vm.state.recent.map((item) => (
          <li key={item.id}>
            <TransactionRow item={item} onClick={() => vm.actions.openTransaction(item.id)} />
          </li>
        ))}
      </ul>
    </section>
  )
}
