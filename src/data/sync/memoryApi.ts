import type { Snapshot } from '@/domain/snapshot'
import { isSyncSecret } from '@/domain/sync/secret'
import { SyncApiError, type SyncApi } from './api'

export interface MemorySyncApi extends SyncApi {
  snapshots: Map<string, Snapshot>
  /** Number of get/put calls. */
  calls: number
  /** Next N puts answer 412. */
  conflictsLeft: number
  /** Awaited before a put is applied. */
  beforePut?: () => Promise<void>
  pendingPuts: number
  /** Most syncs seen between a get and its put at the same time. */
  maxConcurrent: number
}

/** In-memory stand-in for api/snapshot.ts, one store per secret, for tests. */
export function createMemorySyncApi(): MemorySyncApi {
  const etags = new Map<string, string>()
  let version = 0
  let active = 0

  const check = (secret: string) => {
    api.calls++
    if (!isSyncSecret(secret)) throw new SyncApiError('unauthorized')
  }

  const api: MemorySyncApi = {
    snapshots: new Map(),
    calls: 0,
    conflictsLeft: 0,
    pendingPuts: 0,
    maxConcurrent: 0,

    async get(secret) {
      check(secret)
      active++
      api.maxConcurrent = Math.max(api.maxConcurrent, active)
      const snapshot = api.snapshots.get(secret)
      if (!snapshot) return null
      if (!etags.has(secret)) etags.set(secret, `"${++version}"`)
      return { snapshot: structuredClone(snapshot), etag: etags.get(secret)! }
    },

    async put(secret, snapshot, etag) {
      check(secret)
      api.pendingPuts++
      try {
        await api.beforePut?.()
        active = Math.max(0, active - 1)
        if (api.conflictsLeft > 0) {
          api.conflictsLeft--
          return null
        }
        if ((etags.get(secret) ?? null) !== etag) return null
        const next = `"${++version}"`
        api.snapshots.set(secret, structuredClone(snapshot))
        etags.set(secret, next)
        return { etag: next }
      } finally {
        api.pendingPuts--
      }
    },
  }
  return api
}
