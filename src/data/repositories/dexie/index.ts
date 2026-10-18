import { createBackupService } from '@/data/backup'
import type { ExpenseNoteDB } from '@/data/db'
import type { Repositories } from '../types'
import { createFriendRepository } from './friends'
import { createLedgerRepository } from './ledger'
import { createMetaRepository } from './meta'
import { createTransactionRepository } from './transactions'

export function createDexieRepositories(db: ExpenseNoteDB): Repositories {
  const meta = createMetaRepository(db)
  const friends = createFriendRepository(db)
  return {
    transactions: createTransactionRepository(db, friends),
    friends,
    ledger: createLedgerRepository(db),
    meta,
    backup: createBackupService(db, meta),
  }
}
