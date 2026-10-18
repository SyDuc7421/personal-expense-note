import { createBackupService } from '@/data/backup'
import type { ExpenseNoteDB } from '@/data/db'
import { createHttpSyncApi, type SyncApi } from '@/data/sync/api'
import { createSyncService } from '@/data/sync/SyncService'
import type { Repositories } from '../types'
import { createFriendRepository } from './friends'
import { createLedgerRepository } from './ledger'
import { createMetaRepository } from './meta'
import { createTransactionRepository } from './transactions'

export interface DexieRepositoryOptions {
  syncApi?: SyncApi
  isOnline?: () => boolean
}

export function createDexieRepositories(db: ExpenseNoteDB, opts: DexieRepositoryOptions = {}): Repositories {
  const meta = createMetaRepository(db)
  const friends = createFriendRepository(db)
  return {
    transactions: createTransactionRepository(db, friends),
    friends,
    ledger: createLedgerRepository(db),
    meta,
    backup: createBackupService(db, meta),
    sync: createSyncService(db, meta, opts.syncApi ?? createHttpSyncApi(), opts.isOnline ?? (() => navigator.onLine)),
  }
}
