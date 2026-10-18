import { friendBalance } from '@/domain/balance'
import { DomainError } from '@/domain/errors'
import { normalize } from '@/domain/text'
import type { Friend } from '@/domain/types'
import type { GhiSoDB } from '@/data/db'
import type { FriendRepository } from '../types'
import { isAlive, newSyncable, tombstone, touch } from './common'

export function createFriendRepository(db: GhiSoDB): FriendRepository {
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
  }
}
