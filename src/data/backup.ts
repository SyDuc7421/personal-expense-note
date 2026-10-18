import { DomainError } from '@/domain/errors'
import { SCHEMA_VERSION, SNAPSHOT_FORMAT, snapshotSchema, type Snapshot } from '@/domain/snapshot'
import { SYNC_TABLES } from '@/domain/sync/merge'
import { nextUpdatedAt } from '@/domain/sync/clock'
import type { Syncable } from '@/domain/types'
import type { ExpenseNoteDB } from './db'
import type { BackupService, MetaRepository } from './repositories/types'

export async function deviceId(meta: MetaRepository): Promise<string> {
  const existing = await meta.get('deviceId')
  if (existing) return existing
  const id = crypto.randomUUID()
  await meta.set('deviceId', id)
  return id
}

export function parseSnapshot(json: unknown): Snapshot {
  if (typeof json === 'object' && json !== null && 'schemaVersion' in json) {
    const version = (json as { schemaVersion: unknown }).schemaVersion
    if (typeof version === 'number' && version > SCHEMA_VERSION) throw new DomainError('newerSchema')
  }
  const result = snapshotSchema.safeParse(json)
  if (!result.success) throw new DomainError('invalidBackup')
  return result.data
}

export function createBackupService(db: ExpenseNoteDB, meta: MetaRepository): BackupService {
  const tables = [db.friends, db.transactions, db.debts, db.settlements]

  /**
   * With sync on, a plain replace would be undone by the next merge (newer remote versions win and missing records
   * come back). Write every backup record as a new edit and tombstone local records the backup lacks, so the
   * restore wins on every device.
   */
  function importOverSynced(snapshot: Snapshot): Promise<void> {
    return db.transaction('rw', tables, async () => {
      for (const name of SYNC_TABLES) {
        // Each table holds its own record type; the union of tables is not assignable to one Table type.
        const table = db[name] as unknown as { toArray(): Promise<Syncable[]>; bulkPut(items: Syncable[]): Promise<unknown> }
        const local = new Map((await table.toArray()).map((r) => [r.id, r]))
        const restored = (snapshot[name] as Syncable[]).map((r) => {
          const current = local.get(r.id)
          const previous = current && current.updatedAt > r.updatedAt ? current.updatedAt : r.updatedAt
          return { ...r, updatedAt: nextUpdatedAt(previous) }
        })
        const inBackup = new Set(restored.map((r) => r.id))
        const removed = [...local.values()]
          .filter((r) => !inBackup.has(r.id) && r.deletedAt === null)
          .map((r) => {
            const updatedAt = nextUpdatedAt(r.updatedAt)
            return { ...r, updatedAt, deletedAt: updatedAt }
          })
        await table.bulkPut([...restored, ...removed])
      }
    })
  }

  return {
    validateSnapshot: parseSnapshot,

    async exportSnapshot() {
      return {
        format: SNAPSHOT_FORMAT,
        schemaVersion: SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
        updatedBy: await deviceId(meta),
        friends: await db.friends.toArray(),
        transactions: await db.transactions.toArray(),
        debts: await db.debts.toArray(),
        settlements: await db.settlements.toArray(),
      }
    },

    async importSnapshot(json) {
      const snapshot = parseSnapshot(json)
      if (await meta.get('syncSecret')) return importOverSynced(snapshot)
      await db.transaction('rw', tables, async () => {
        await Promise.all(tables.map((t) => t.clear()))
        await db.friends.bulkAdd(snapshot.friends)
        await db.transactions.bulkAdd(snapshot.transactions)
        await db.debts.bulkAdd(snapshot.debts)
        await db.settlements.bulkAdd(snapshot.settlements)
      })
    },

    async clearAll() {
      await db.transaction('rw', [...tables, db.meta], async () => {
        await Promise.all(tables.map((t) => t.clear()))
        await db.meta.delete('lastExportAt')
      })
    },
  }
}
