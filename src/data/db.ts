import Dexie, { type Table } from 'dexie'
import type { Debt, Friend, Meta, Settlement, Transaction } from '@/domain/types'

export class ExpenseNoteDB extends Dexie {
  friends!: Table<Friend, string>
  transactions!: Table<Transaction, string>
  debts!: Table<Debt, string>
  settlements!: Table<Settlement, string>
  meta!: Table<Meta, string>

  constructor(name: string) {
    super(name)
    this.version(1).stores({
      friends: 'id, name, archived, updatedAt',
      transactions: 'id, date, type, category, updatedAt',
      debts: 'id, transactionId, friendId, updatedAt',
      settlements: 'id, friendId, date, updatedAt',
      meta: 'key',
    })
  }
}

export function createDb(name = 'personal-expense-note'): ExpenseNoteDB {
  return new ExpenseNoteDB(name)
}
