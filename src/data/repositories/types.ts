import type { Snapshot } from '@/domain/snapshot'
import type { DebtEntry, Friend, NewTransaction, Settlement, TransactionWithDebts } from '@/domain/types'

export interface TransactionRepository {
  /** month = YYYY-MM; newest first. */
  listByMonth(month: string): Promise<TransactionWithDebts[]>
  listRecent(limit: number): Promise<TransactionWithDebts[]>
  get(id: string): Promise<TransactionWithDebts | undefined>
  count(): Promise<number>
  /** Transaction + debts in one Dexie transaction. */
  create(input: NewTransaction): Promise<string>
  update(id: string, input: NewTransaction): Promise<void>
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
  /** Only allowed when the friend's balance is 0. */
  remove(id: string): Promise<void>
}

export type FriendDebtEntry = DebtEntry & { friendId: string }

export interface LedgerRepository {
  /** Live debts joined with their live transactions. */
  listDebtEntries(friendId?: string): Promise<FriendDebtEntry[]>
  listSettlements(friendId?: string): Promise<Settlement[]>
  addSettlement(input: { friendId: string; amount: number; date: string; note: string }): Promise<string>
  removeSettlement(id: string): Promise<void>
}

export interface MetaRepository {
  get(key: string): Promise<string | undefined>
  set(key: string, value: string): Promise<void>
}

export interface BackupService {
  /** Full snapshot including tombstones. */
  exportSnapshot(): Promise<Snapshot>
  /** Validates, then replaces all synced data in one Dexie transaction. */
  importSnapshot(json: unknown): Promise<void>
  /** Deletes all synced data and lastExportAt. */
  clearAll(): Promise<void>
}

export interface Repositories {
  transactions: TransactionRepository
  friends: FriendRepository
  ledger: LedgerRepository
  meta: MetaRepository
  backup: BackupService
}
