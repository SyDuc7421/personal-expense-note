import { liveQuery } from 'dexie'
import type { SyncService } from '../repositories/types'

type PendingSource = (onChange: (pending: boolean) => void) => () => void

/**
 * Spec 9.5: sync on start, on foreground, when back online, and `debounceMs` after the last local write.
 * Also on `offline`: sync() sees navigator.onLine false and sets the offline status without a request. Returns cleanup.
 */
export function startSyncTriggers(
  sync: SyncService,
  opts: { debounceMs?: number; pending?: PendingSource } = {},
): () => void {
  const debounceMs = opts.debounceMs ?? 5000
  const pending: PendingSource =
    opts.pending ??
    ((onChange) => {
      const subscription = liveQuery(() => sync.hasPendingChanges()).subscribe({ next: onChange, error: () => {} })
      return () => subscription.unsubscribe()
    })

  let timer: ReturnType<typeof setTimeout> | undefined
  const run = () => void sync.sync()
  const onVisible = () => {
    if (document.visibilityState === 'visible') run()
  }

  window.addEventListener('online', run)
  window.addEventListener('offline', run)
  document.addEventListener('visibilitychange', onVisible)
  const unsubscribe = pending((isPending) => {
    clearTimeout(timer)
    if (isPending) timer = setTimeout(run, debounceMs)
  })
  run()

  return () => {
    clearTimeout(timer)
    window.removeEventListener('online', run)
    window.removeEventListener('offline', run)
    document.removeEventListener('visibilitychange', onVisible)
    unsubscribe()
  }
}
