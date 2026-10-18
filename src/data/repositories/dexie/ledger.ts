import { DomainError } from '@/domain/errors'
import type { Settlement } from '@/domain/types'
import type { GhiSoDB } from '@/data/db'
import type { FriendDebtEntry, LedgerRepository } from '../types'
import { byCreated, isAlive, newSyncable, tombstone } from './common'

export function createLedgerRepository(db: GhiSoDB): LedgerRepository {
  return {
    async listDebtEntries(friendId) {
      const debts = await (friendId ? db.debts.where('friendId').equals(friendId) : db.debts.toCollection())
        .filter(isAlive)
        .toArray()
      const txs = await db.transactions.bulkGet([...new Set(debts.map((d) => d.transactionId))])
      const txById = new Map(txs.filter(isAlive).map((t) => [t.id, t]))
      return debts.flatMap((d): FriendDebtEntry[] => {
        const tx = txById.get(d.transactionId)
        if (!tx) return []
        return [{ debtId: d.id, transactionId: tx.id, friendId: d.friendId, date: tx.date, note: tx.note, amount: d.amount }]
      })
    },

    async listSettlements(friendId) {
      const items = await (friendId ? db.settlements.where('friendId').equals(friendId) : db.settlements.toCollection())
        .filter(isAlive)
        .toArray()
      return items.sort((a, b) => a.date.localeCompare(b.date) || byCreated(a, b))
    },

    async addSettlement(input) {
      if (!Number.isInteger(input.amount) || input.amount <= 0) throw new DomainError('invalidAmount')
      const settlement: Settlement = { ...newSyncable(), ...input, note: input.note.trim() }
      await db.settlements.add(settlement)
      return settlement.id
    },

    async removeSettlement(id) {
      const s = await db.settlements.get(id)
      if (!isAlive(s)) throw new DomainError('notFound')
      await db.settlements.put({ ...s, ...tombstone(s) })
    },
  }
}
