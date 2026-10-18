import type { Snapshot } from '@/domain/snapshot'
import type { DebtEntry, Friend, NewTransaction, Settlement, TransactionWithDebts } from '@/domain/types'

export type NewTransactionWithFriendNames = Omit<NewTransaction, 'splits'> & {
  splits: { friendId?: string; friendName: string; amount: number }[]
}

export interface TransactionRepository {
  /** month = YYYY-MM; newest first. */
  listByMonth(month: string): Promise<TransactionWithDebts[]>
  listRecent(limit: number): Promise<TransactionWithDebts[]>
  get(id: string): Promise<TransactionWithDebts | undefined>
  count(): Promise<number>
  /** Transaction + debts in one Dexie transaction. */
  create(input: NewTransaction): Promise<string>
  update(id: string, input: NewTransaction): Promise<void>
  /** Like create, but splits may name friends that do not exist yet; they are created in the same Dexie transaction. */
  createWithFriends(input: NewTransactionWithFriendNames): Promise<string>
  /** Soft deletes the transaction and its debts. */
  remove(id: string): Promise<void>
}

export interface FriendRepository {
  list(opts?: { includeArchived?: boolean }): Promise<Friend[]>
  get(id: string): Promise<Friend | undefined>
  findByName(name: string): Promise<Friend | undefined>
  create(name: string): Promise<string>
  rename(id: string, name: string): Promise<void>
  setArchived(id: string, archived: boolean): Promise<void>
  /** Only allowed when the friend has no debts or settlements at all; otherwise archive. */
  remove(id: string): Promise<void>
}

export type FriendDebtEntry = DebtEntry & { friendId: string }

export interface LedgerRepository {
  /** Live debts joined with their live transactions. */
  listDebtEntries(friendId?: string): Promise<FriendDebtEntry[]>
  listSettlements(friendId?: string): Promise<Settlement[]>
  addSettlement(input: { friendId: string; amount: number; date: string; note: string; debtIds?: string[] }): Promise<string>
  removeSettlement(id: string): Promise<void>
}

export interface MetaRepository {
  get(key: string): Promise<string | undefined>
  set(key: string, value: string): Promise<void>
}

export interface BackupService {
  /** Full snapshot including tombstones. */
  exportSnapshot(): Promise<Snapshot>
  /** Throws DomainError invalidBackup/newerSchema when `json` is not an importable snapshot. */
  validateSnapshot(json: unknown): Snapshot
  /** Validates, then replaces all synced data in one Dexie transaction. */
  importSnapshot(json: unknown): Promise<void>
  /** Deletes all synced data and lastExportAt. */
  clearAll(): Promise<void>
}

export type SyncError = 'unauthorized' | 'conflict' | 'newerSchema' | 'invalidRemote' | 'failed'

export type SyncStatus = { phase: 'disabled' | 'idle' | 'syncing' | 'offline' } | { phase: 'error'; error: SyncError }

export interface SyncService {
  /** Resolves when done; never throws. Concurrent calls join the running sync and schedule one rerun. */
  sync(): Promise<void>
  getStatus(): SyncStatus
  /** For useSyncExternalStore. */
  subscribe(listener: () => void): () => void
  /** Generates a new code (a new store on the server), saves it and syncs. */
  createSecret(): Promise<string>
  /** Throws DomainError syncCodeNotFound (saving nothing) when the server has no data for the code; else saves it and syncs. */
  joinWithSecret(secret: string): Promise<void>
  disable(): Promise<void>
  /** Any synced record changed since the last upload. Works inside a live query. */
  hasPendingChanges(): Promise<boolean>
}

export interface Repositories {
  transactions: TransactionRepository
  friends: FriendRepository
  ledger: LedgerRepository
  meta: MetaRepository
  backup: BackupService
  sync: SyncService
}
