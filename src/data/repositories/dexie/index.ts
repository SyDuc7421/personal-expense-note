import { createBackupService } from '@/data/backup'
import type { GhiSoDB } from '@/data/db'
import type { Repositories } from '../types'
import { createFriendRepository } from './friends'
import { createLedgerRepository } from './ledger'
import { createMetaRepository } from './meta'
import { createTransactionRepository } from './transactions'

export function createDexieRepositories(db: GhiSoDB): Repositories {
  const meta = createMetaRepository(db)
  return {
    transactions: createTransactionRepository(db),
    friends: createFriendRepository(db),
    ledger: createLedgerRepository(db),
    meta,
    backup: createBackupService(db, meta),
  }
}
