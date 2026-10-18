import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { ListSkeleton } from '@/components/ListSkeleton'
import { useOverviewViewModel } from '../viewmodels/useOverviewViewModel'
import { RecentTransactions } from './RecentTransactions'

/** `quickInput` is injected by the app router so this view does not import another feature's views. */
export function OverviewScreen({ quickInput }: { quickInput?: ReactNode }) {
  const { t } = useTranslation()
  const vm = useOverviewViewModel()
  const { state } = vm

  return (
    <div className="flex flex-col gap-4 pb-4">
      {quickInput}
      {state.isLoading ? (
        <ListSkeleton rows={3} />
      ) : state.error ? (
        <ErrorState message={t('common.loadError')} />
      ) : state.isEmpty ? (
        <EmptyState title={t('overview.empty')} />
      ) : (
        <RecentTransactions vm={vm} />
      )}
    </div>
  )
}
