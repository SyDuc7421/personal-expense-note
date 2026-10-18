import { normalize } from '../text'
import type { Friend, Syncable, TransactionWithDebts } from '../types'
import { nextUpdatedAt } from './clock'
import type { SnapshotData } from './merge'

/** Σ live debts > amount, possible after two devices edit the same transaction. Spec 9.3. */
export function needsReview(tx: TransactionWithDebts): boolean {
  const owed = tx.debts.filter((d) => d.deletedAt === null).reduce((acc, d) => acc + d.amount, 0)
  return owed > tx.amount
}

/** Groups (size ≥ 2) of live friends with the same normalized name, each oldest first. Spec 9.6. */
export function findDuplicateFriendGroups(friends: Friend[]): Friend[][] {
  const groups = new Map<string, Friend[]>()
  for (const f of friends) {
    if (f.deletedAt !== null) continue
    const key = normalize(f.name)
    groups.set(key, [...(groups.get(key) ?? []), f])
  }
  return [...groups.values()]
    .filter((g) => g.length > 1)
    .map((g) => g.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)))
}

/**
 * After a duplicate-friend merge, a device that had not synced yet can still add or edit debts on the deleted
 * duplicate. Moves live debts/settlements of a deleted friend to the live friend with the same name (oldest first).
 * Returns `data` unchanged (same reference) when nothing needs moving.
 */
export function reassignFromMergedFriends(data: SnapshotData, now: Date): SnapshotData {
  const keeperByName = new Map<string, string>()
  for (const f of [...data.friends].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))) {
    if (f.deletedAt === null && !keeperByName.has(normalize(f.name))) keeperByName.set(normalize(f.name), f.id)
  }
  const target = new Map<string, string>()
  for (const f of data.friends) {
    const keeper = keeperByName.get(normalize(f.name))
    if (f.deletedAt !== null && keeper) target.set(f.id, keeper)
  }
  let changed = false
  const move = <T extends Syncable & { friendId: string }>(items: T[]): T[] =>
    items.map((r) => {
      const keeper = target.get(r.friendId)
      if (r.deletedAt !== null || !keeper) return r
      changed = true
      return { ...r, friendId: keeper, updatedAt: nextUpdatedAt(r.updatedAt, now) }
    })
  const debts = move(data.debts)
  const settlements = move(data.settlements)
  return changed ? { ...data, debts, settlements } : data
}
