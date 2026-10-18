import Dexie, { type Transaction } from 'dexie'
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
/** Bumped after every local write (not sync's own); "pending" = it moved since the last upload. */
const LOCAL_SEQ_KEY = 'localChangeSeq'
const SYNCED_SEQ_KEY = 'syncedChangeSeq'
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
  // A counter instead of comparing updatedAt: another device's clock may run ahead of ours.
  let mergeTx: Transaction | null = null
  const counted = new WeakSet<Transaction>()
  const bumpSeq = () =>
    Dexie.ignoreTransaction(() =>
      db.transaction('rw', db.meta, async () => {
        const seq = Number((await db.meta.get(LOCAL_SEQ_KEY))?.value ?? 0)
        await db.meta.put({ key: LOCAL_SEQ_KEY, value: String(seq + 1) })
      }),
    )
  function countChange(tx: Transaction) {
    if (tx === mergeTx || counted.has(tx)) return
    counted.add(tx)
    tx.on('complete', () => void bumpSeq())
  }
  for (const table of tables) {
    table.hook('creating', (_key, _obj, tx) => countChange(tx))
    table.hook('updating', (_mods, _key, _obj, tx) => countChange(tx))
    table.hook('deleting', (_key, _obj, tx) => countChange(tx))
  }

  function setStatus(next: SyncStatus) {
    status = next
    listeners.forEach((l) => l())
  }

  async function resetRemoteState() {
    await db.meta.bulkDelete([REMOTE_ETAG_KEY, SYNCED_SEQ_KEY])
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
      mergeTx = Dexie.currentTransaction
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
    }).finally(() => {
      mergeTx = null
    })
  }

  const sameData = (a: SnapshotData, b: SnapshotData) =>
    SYNC_TABLES.every((name) => {
      const other = new Map((b[name] as Syncable[]).map((r) => [r.id, canonicalJson(r)]))
      return a[name].length === other.size && (a[name] as Syncable[]).every((r) => other.get(r.id) === canonicalJson(r))
    })

  /** 'stale' = sync was turned off or the code changed mid-run; nothing more is recorded. */
  async function attempt(secret: string): Promise<'ok' | 'conflict' | 'stale'> {
    const seqAtStart = (await meta.get(LOCAL_SEQ_KEY)) ?? '0'
    const remote = await fetchRemote(secret)
    const data = await mergeIntoLocal(remote.data)
    const now = new Date().toISOString()
    const record = async (etag: string) => {
      if ((await meta.get(SYNC_SECRET_KEY)) !== secret) return 'stale' as const
      await meta.set(REMOTE_ETAG_KEY, etag)
      await meta.set(LAST_SYNC_KEY, now)
      await meta.set(SYNCED_SEQ_KEY, seqAtStart)
      return 'ok' as const
    }
    // Nothing to add to the server copy: skip the upload (saves quota and doesn't bump the ETag for other devices).
    if (remote.etag !== null && sameData(data, remote.data)) return record(remote.etag)
    const snapshot: Snapshot = {
      format: SNAPSHOT_FORMAT,
      schemaVersion: SCHEMA_VERSION,
      updatedAt: now,
      updatedBy: await deviceId(meta),
      ...data,
    }
    const written = await api.put(secret, snapshot, remote.etag)
    return written ? record(written.etag) : 'conflict'
  }

  async function runOnce(): Promise<void> {
    const secret = await meta.get(SYNC_SECRET_KEY)
    if (!secret) return setStatus({ phase: 'disabled' })
    if (!isOnline()) return setStatus({ phase: 'offline' })
    setStatus({ phase: 'syncing' })
    try {
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        const result = await attempt(secret)
        if (result === 'stale') return
        if (result === 'ok') return setStatus({ phase: 'idle' })
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
      return ((await meta.get(LOCAL_SEQ_KEY)) ?? '0') !== ((await meta.get(SYNCED_SEQ_KEY)) ?? '')
    },
  }
  return service
}
