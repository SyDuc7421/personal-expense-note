import { normalize } from '../text'
import type { Friend, TransactionWithDebts } from '../types'

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
