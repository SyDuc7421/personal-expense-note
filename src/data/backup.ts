import { DomainError } from '@/domain/errors'
import { SCHEMA_VERSION, SNAPSHOT_FORMAT, snapshotSchema, type Snapshot } from '@/domain/snapshot'
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
