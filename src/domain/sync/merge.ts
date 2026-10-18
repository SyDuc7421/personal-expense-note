import type { Snapshot } from '../snapshot'
import type { Syncable } from '../types'

export type SnapshotData = Pick<Snapshot, 'friends' | 'transactions' | 'debts' | 'settlements'>

export const SYNC_TABLES = ['friends', 'transactions', 'debts', 'settlements'] as const

export const EMPTY_SNAPSHOT_DATA: SnapshotData = { friends: [], transactions: [], debts: [], settlements: [] }

export const TOMBSTONE_TTL_DAYS = 180
const DAY_MS = 86_400_000

/** JSON with sorted top-level keys, so equal records compare equal whatever order their keys were built in. */
export function canonicalJson(record: object): string {
  return JSON.stringify(record, Object.keys(record).sort())
}

/** Spec 9.3: last-write-wins; tie → deleted wins; tie → larger JSON string, so every device picks the same record. */
function pick<T extends Syncable>(a: T, b: T): T {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b
  if ((a.deletedAt === null) !== (b.deletedAt === null)) return a.deletedAt !== null ? a : b
  return canonicalJson(a) >= canonicalJson(b) ? a : b
}

/** Union by id, sorted by id. Commutative and idempotent. */
export function mergeRecords<T extends Syncable>(local: T[], remote: T[]): T[] {
  const byId = new Map<string, T>()
  for (const record of [...local, ...remote]) {
    const existing = byId.get(record.id)
    byId.set(record.id, existing ? pick(existing, record) : record)
  }
  return [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

export function merge(local: SnapshotData, remote: SnapshotData): SnapshotData {
  return {
    friends: mergeRecords(local.friends, remote.friends),
    transactions: mergeRecords(local.transactions, remote.transactions),
    debts: mergeRecords(local.debts, remote.debts),
    settlements: mergeRecords(local.settlements, remote.settlements),
  }
}

/** Spec 9.8: tombstones older than 180 days are dropped everywhere. */
export function purgeTombstones(
  data: SnapshotData,
  now: Date,
): { data: SnapshotData; purged: Record<keyof SnapshotData, string[]> } {
  const cutoff = now.getTime() - TOMBSTONE_TTL_DAYS * DAY_MS
  const expired = (r: Syncable) => r.deletedAt !== null && Date.parse(r.deletedAt) < cutoff
  const split = <T extends Syncable>(items: T[]) => ({
    kept: items.filter((r) => !expired(r)),
    purged: items.filter(expired).map((r) => r.id),
  })
  const friends = split(data.friends)
  const transactions = split(data.transactions)
  const debts = split(data.debts)
  const settlements = split(data.settlements)
  return {
    data: { friends: friends.kept, transactions: transactions.kept, debts: debts.kept, settlements: settlements.kept },
    purged: { friends: friends.purged, transactions: transactions.purged, debts: debts.purged, settlements: settlements.purged },
  }
}
