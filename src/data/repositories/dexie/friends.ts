import { friendBalance } from '@/domain/balance'
import { DomainError } from '@/domain/errors'
import { findDuplicateFriendGroups } from '@/domain/sync/integrity'
import { normalize } from '@/domain/text'
import type { Friend } from '@/domain/types'
import type { ExpenseNoteDB } from '@/data/db'
import type { FriendRepository } from '../types'
import { isAlive, newSyncable, tombstone, touch } from './common'

export function createFriendRepository(db: ExpenseNoteDB): FriendRepository {
  async function alive(): Promise<Friend[]> {
    return db.friends.filter(isAlive).toArray()
  }

  async function assertUniqueName(name: string, exceptId?: string): Promise<string> {
    const trimmed = name.trim().replace(/\s+/g, ' ')
    if (!trimmed) throw new DomainError('emptyName')
    const key = normalize(trimmed)
    if ((await alive()).some((f) => f.id !== exceptId && normalize(f.name) === key)) throw new DomainError('duplicateName')
    return trimmed
  }

  async function getAlive(id: string): Promise<Friend> {
    const friend = await db.friends.get(id)
    if (!isAlive(friend)) throw new DomainError('notFound')
    return friend
  }

  return {
    async list(opts) {
      const friends = (await alive()).filter((f) => opts?.includeArchived || !f.archived)
      return friends.sort((a, b) => a.name.localeCompare(b.name, 'vi'))
    },

    async get(id) {
      const friend = await db.friends.get(id)
      return isAlive(friend) ? friend : undefined
    },

    async findByName(name) {
      const key = normalize(name)
      return (await alive()).find((f) => normalize(f.name) === key)
    },

    async create(name) {
      const friend: Friend = { ...newSyncable(), name: await assertUniqueName(name), archived: false }
      await db.friends.add(friend)
      return friend.id
    },

    async rename(id, name) {
      const friend = await getAlive(id)
      await db.friends.put({ ...friend, name: await assertUniqueName(name, id), ...touch(friend) })
    },

    async setArchived(id, archived) {
      const friend = await getAlive(id)
      await db.friends.put({ ...friend, archived, ...touch(friend) })
    },

    async remove(id) {
      await db.transaction('rw', db.friends, db.debts, db.transactions, db.settlements, async () => {
        const friend = await getAlive(id)
        const debts = await db.debts.where('friendId').equals(id).filter(isAlive).toArray()
        const txs = await db.transactions.bulkGet(debts.map((d) => d.transactionId))
        const liveDebts = debts.filter((_, i) => isAlive(txs[i]))
        const settlements = await db.settlements.where('friendId').equals(id).filter(isAlive).toArray()
        if (friendBalance(liveDebts, settlements) !== 0) throw new DomainError('nonZeroBalance')
        // Deleting a friend that debts/settlements still point at would orphan them (nameless rows, phantom balances).
        if (debts.length > 0 || settlements.length > 0) throw new DomainError('friendHasHistory')
        await db.friends.put({ ...friend, ...tombstone(friend) })
      })
    },

    async mergeDuplicates() {
      return db.transaction('rw', db.friends, db.debts, db.settlements, async () => {
        let removed = 0
        for (const [keeper, ...duplicates] of findDuplicateFriendGroups(await db.friends.toArray())) {
          for (const dup of duplicates) {
            const keeperDebts = await db.debts.where('friendId').equals(keeper.id).filter(isAlive).toArray()
            for (const debt of await db.debts.where('friendId').equals(dup.id).filter(isAlive).toArray()) {
              // One friend must not owe twice on one transaction (the edit form would reject it): fold into the keeper's debt.
              const existing = keeperDebts.find((d) => d.transactionId === debt.transactionId)
              if (existing) {
                existing.amount += debt.amount
                Object.assign(existing, touch(existing))
                await db.debts.put(existing)
                await db.debts.put({ ...debt, ...tombstone(debt) })
              } else {
                await db.debts.put({ ...debt, friendId: keeper.id, ...touch(debt) })
              }
            }
            for (const s of await db.settlements.where('friendId').equals(dup.id).filter(isAlive).toArray()) {
              await db.settlements.put({ ...s, friendId: keeper.id, ...touch(s) })
            }
            await db.friends.put({ ...dup, ...tombstone(dup) })
            removed++
          }
        }
        return removed
      })
    },
  }
}
