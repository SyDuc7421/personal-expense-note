import { useSyncExternalStore } from 'react'
import { useRepositories } from '@/data/RepositoryProvider'
import { LAST_SYNC_KEY, SYNC_SECRET_KEY } from '@/data/sync/SyncService'
import { useRepoQuery } from './useRepoQuery'

/** Header dot (spec 9.7): green synced, gray offline, orange unsynced changes or error. */
export type SyncIndicator = 'none' | 'synced' | 'offline' | 'pending'

export function useSyncStatus() {
  const { sync, meta } = useRepositories()
  const status = useSyncExternalStore(sync.subscribe, sync.getStatus)
  const info = useRepoQuery(
    async () => ({
      code: (await meta.get(SYNC_SECRET_KEY)) ?? null,
      lastSyncAt: await meta.get(LAST_SYNC_KEY),
      pending: await sync.hasPendingChanges(),
    }),
    [sync, meta],
  )
  const code = info.data?.code ?? null
  let indicator: SyncIndicator = 'synced'
  if (!code) indicator = 'none'
  else if (status.phase === 'offline') indicator = 'offline'
  else if (info.data?.pending || status.phase === 'error') indicator = 'pending'

  return {
    isLoading: info.isLoading,
    error: info.error,
    status,
    code,
    lastSyncAt: info.data?.lastSyncAt,
    indicator,
    syncNow: () => sync.sync(),
  }
}
