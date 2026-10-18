import type { Snapshot } from '@/domain/snapshot'
import { isSyncSecret } from '@/domain/sync/secret'
import { SyncApiError, type SyncApi } from './api'

export interface MemorySyncApi extends SyncApi {
  snapshots: Map<string, Snapshot>
  /** Number of get/put calls. */
  calls: number
  /** Next N puts answer 412. */
  conflictsLeft: number
  /** Awaited before a get answers / a put is applied. */
  beforeGet?: () => Promise<void>
  beforePut?: () => Promise<void>
  pendingGets: number
  pendingPuts: number
  /** Successful puts. */
  puts: number
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
    pendingGets: 0,
    pendingPuts: 0,
    puts: 0,
    maxConcurrent: 0,

    async get(secret) {
      check(secret)
      api.pendingGets++
      try {
        await api.beforeGet?.()
      } finally {
        api.pendingGets--
      }
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
        api.puts++
        return { etag: next }
      } finally {
        api.pendingPuts--
      }
    },
  }
  return api
}
