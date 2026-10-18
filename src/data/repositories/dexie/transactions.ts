import { DomainError } from '@/domain/errors'
import type { Debt, NewTransaction, Transaction, TransactionWithDebts } from '@/domain/types'
import type { GhiSoDB } from '@/data/db'
import type { TransactionRepository } from '../types'
import { byCreated, isAlive, newSyncable, tombstone, touch } from './common'

const isPositiveInt = (n: number) => Number.isInteger(n) && n > 0

function validate(input: NewTransaction): void {
  if (!isPositiveInt(input.amount)) throw new DomainError('invalidAmount')
  if (input.type === 'income' && input.splits.length > 0) throw new DomainError('incomeWithSplits')
  if (input.splits.some((s) => !isPositiveInt(s.amount))) throw new DomainError('invalidAmount')
  if (new Set(input.splits.map((s) => s.friendId)).size !== input.splits.length) throw new DomainError('duplicateSplitFriend')
  const owed = input.splits.reduce((acc, s) => acc + s.amount, 0)
  if (owed > input.amount) throw new DomainError('splitsExceedAmount')
}

const newestFirst = (a: Transaction, b: Transaction) =>
  b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)

export function createTransactionRepository(db: GhiSoDB): TransactionRepository {
  async function withDebts(txs: Transaction[]): Promise<TransactionWithDebts[]> {
    const debts = await db.debts.where('transactionId').anyOf(txs.map((t) => t.id)).filter(isAlive).toArray()
    return txs.map((t) => ({ ...t, debts: debts.filter((d) => d.transactionId === t.id).sort(byCreated) }))
  }

  function fields(input: NewTransaction) {
    const { splits: _splits, ...rest } = input
    return { ...rest, note: rest.note.trim() }
  }

  return {
    async listByMonth(month) {
      const txs = await db.transactions.where('date').between(`${month}-01`, `${month}-31`, true, true).filter(isAlive).toArray()
      return withDebts(txs.sort(newestFirst))
    },

    async listRecent(limit) {
      const txs = await db.transactions.filter(isAlive).toArray()
      return withDebts(txs.sort(newestFirst).slice(0, limit))
    },

    async get(id) {
      const tx = await db.transactions.get(id)
      if (!isAlive(tx)) return undefined
      return (await withDebts([tx]))[0]
    },

    count() {
      return db.transactions.filter(isAlive).count()
    },

    async create(input) {
      validate(input)
      const tx: Transaction = { ...newSyncable(), ...fields(input) }
      await db.transaction('rw', db.transactions, db.debts, async () => {
        await db.transactions.add(tx)
        await db.debts.bulkAdd(input.splits.map((s) => ({ ...newSyncable(), transactionId: tx.id, ...s })))
      })
      return tx.id
    },

    async update(id, input) {
      validate(input)
      await db.transaction('rw', db.transactions, db.debts, async () => {
        const tx = await db.transactions.get(id)
        if (!isAlive(tx)) throw new DomainError('notFound')
        const next: Transaction = { ...tx, ...fields(input), ...touch(tx) }
        if (input.rawInput === undefined) delete next.rawInput
        await db.transactions.put(next)

        const existing = await db.debts.where('transactionId').equals(id).filter(isAlive).toArray()
        const changes: Debt[] = []
        for (const debt of existing) {
          const split = input.splits.find((s) => s.friendId === debt.friendId)
          if (!split) changes.push({ ...debt, ...tombstone(debt) })
          else if (split.amount !== debt.amount) changes.push({ ...debt, amount: split.amount, ...touch(debt) })
        }
        for (const split of input.splits) {
          if (!existing.some((d) => d.friendId === split.friendId)) {
            changes.push({ ...newSyncable(), transactionId: id, ...split })
          }
        }
        await db.debts.bulkPut(changes)
      })
    },

    async remove(id) {
      await db.transaction('rw', db.transactions, db.debts, async () => {
        const tx = await db.transactions.get(id)
        if (!isAlive(tx)) throw new DomainError('notFound')
        await db.transactions.put({ ...tx, ...tombstone(tx) })
        const debts = await db.debts.where('transactionId').equals(id).filter(isAlive).toArray()
        await db.debts.bulkPut(debts.map((d) => ({ ...d, ...tombstone(d) })))
      })
    },
  }
}
