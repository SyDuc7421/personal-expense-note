import { DomainError } from '@/domain/errors'
import { SCHEMA_VERSION, SNAPSHOT_FORMAT, type Snapshot } from '@/domain/snapshot'
import { canonicalJson, EMPTY_SNAPSHOT_DATA, merge, purgeTombstones, SYNC_TABLES, type SnapshotData } from '@/domain/sync/merge'
import { reassignFromMergedFriends } from '@/domain/sync/integrity'
import { generateSyncSecret, isSyncSecret } from '@/domain/sync/secret'
import type { Syncable } from '@/domain/types'
import { deviceId, parseSnapshot } from '../backup'
import type { ExpenseNoteDB } from '../db'
import type { MetaRepository, SyncError, SyncService, SyncStatus } from '../repositories/types'
import { SyncApiError, type SyncApi } from './api'

export const SYNC_SECRET_KEY = 'syncSecret'
export const LAST_SYNC_KEY = 'lastSyncAt'
const REMOTE_ETAG_KEY = 'remoteEtag'
const SYNCED_UP_TO_KEY = 'syncedUpTo'
const MAX_ATTEMPTS = 3

/** Ends one sync run with a final status. */
class Stop {
  readonly status: SyncStatus
  constructor(status: SyncStatus) {
    this.status = status
  }
}
const fail = (error: SyncError) => new Stop({ phase: 'error', error })

/** Spec 9.5. */
export function createSyncService(
  db: ExpenseNoteDB,
  meta: MetaRepository,
  api: SyncApi,
  isOnline: () => boolean,
): SyncService {
  const tables = SYNC_TABLES.map((name) => db[name])
  const listeners = new Set<() => void>()
  let status: SyncStatus = { phase: 'idle' }
  let running: Promise<void> | null = null
  let rerun = false

  function setStatus(next: SyncStatus) {
    status = next
    listeners.forEach((l) => l())
  }

  async function resetRemoteState() {
    await db.meta.bulkDelete([REMOTE_ETAG_KEY, SYNCED_UP_TO_KEY])
  }

  async function fetchRemote(secret: string): Promise<{ data: SnapshotData; etag: string | null }> {
    const remote = await api.get(secret)
    if (!remote) return { data: EMPTY_SNAPSHOT_DATA, etag: null }
    try {
      return { data: parseSnapshot(remote.snapshot), etag: remote.etag }
    } catch (e) {
      throw fail(e instanceof DomainError && e.code === 'newerSchema' ? 'newerSchema' : 'invalidRemote')
    }
  }

  /** Reads local data inside the same rw transaction that writes the merge, so a concurrent edit is never overwritten. */
  function mergeIntoLocal(remote: SnapshotData): Promise<SnapshotData> {
    return db.transaction('rw', tables, async () => {
      const local: SnapshotData = {
        friends: await db.friends.toArray(),
        transactions: await db.transactions.toArray(),
        debts: await db.debts.toArray(),
        settlements: await db.settlements.toArray(),
      }
      const now = new Date()
      const purgedResult = purgeTombstones(merge(local, remote), now)
      const data = reassignFromMergedFriends(purgedResult.data, now)
      const { purged } = purgedResult
      for (const name of SYNC_TABLES) {
        const before = new Map((local[name] as Syncable[]).map((r) => [r.id, canonicalJson(r)]))
        const changed = (data[name] as Syncable[]).filter((r) => before.get(r.id) !== canonicalJson(r))
        // Each table holds its own record type; the union of tables is not assignable to one Table type.
        const table = db[name] as unknown as { bulkPut(items: Syncable[]): Promise<unknown>; bulkDelete(ids: string[]): Promise<void> }
        await table.bulkPut(changed)
        await table.bulkDelete(purged[name])
      }
      return data
    })
  }

  async function attempt(secret: string): Promise<boolean> {
    const remote = await fetchRemote(secret)
    const data = await mergeIntoLocal(remote.data)
    const now = new Date().toISOString()
    const snapshot: Snapshot = {
      format: SNAPSHOT_FORMAT,
      schemaVersion: SCHEMA_VERSION,
      updatedAt: now,
      updatedBy: await deviceId(meta),
      ...data,
    }
    const written = await api.put(secret, snapshot, remote.etag)
    if (!written) return false
    const newest = SYNC_TABLES.flatMap((name) => (data[name] as Syncable[]).map((r) => r.updatedAt)).sort().at(-1)
    await meta.set(REMOTE_ETAG_KEY, written.etag)
    await meta.set(LAST_SYNC_KEY, now)
    if (newest) await meta.set(SYNCED_UP_TO_KEY, newest)
    return true
  }

  async function runOnce(): Promise<void> {
    const secret = await meta.get(SYNC_SECRET_KEY)
    if (!secret) return setStatus({ phase: 'disabled' })
    if (!isOnline()) return setStatus({ phase: 'offline' })
    setStatus({ phase: 'syncing' })
    try {
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        if (await attempt(secret)) return setStatus({ phase: 'idle' })
      }
      setStatus({ phase: 'error', error: 'conflict' })
    } catch (e) {
      if (e instanceof Stop) return setStatus(e.status)
      if (e instanceof SyncApiError) {
        if (e.kind === 'unauthorized') return setStatus({ phase: 'error', error: 'unauthorized' })
        if (e.kind === 'network') return setStatus({ phase: 'offline' })
      }
      setStatus({ phase: 'error', error: 'failed' })
    }
  }

  const service: SyncService = {
    sync() {
      if (running) {
        rerun = true
        return running
      }
      running = (async () => {
        do {
          rerun = false
          await runOnce()
        } while (rerun)
      })().finally(() => {
        running = null
      })
      return running
    },

    getStatus: () => status,

    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    async createSecret() {
      const secret = generateSyncSecret()
      await resetRemoteState()
      await meta.set(SYNC_SECRET_KEY, secret)
      await service.sync()
      return secret
    },

    async joinWithSecret(input) {
      const secret = input.trim()
      if (!isSyncSecret(secret)) throw new DomainError('syncCodeNotFound')
      if (!(await api.get(secret))) throw new DomainError('syncCodeNotFound')
      await resetRemoteState()
      await meta.set(SYNC_SECRET_KEY, secret)
      await service.sync()
    },

    async disable() {
      await resetRemoteState()
      await db.meta.delete(SYNC_SECRET_KEY)
      setStatus({ phase: 'disabled' })
    },

    async hasPendingChanges() {
      if (!(await meta.get(SYNC_SECRET_KEY))) return false
      const syncedUpTo = await meta.get(SYNCED_UP_TO_KEY)
      for (const table of tables) {
        const count = syncedUpTo ? await table.where('updatedAt').above(syncedUpTo).count() : await table.count()
        if (count > 0) return true
      }
      return false
    },
  }
  return service
}
