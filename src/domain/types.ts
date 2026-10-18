export interface Syncable {
  id: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface Friend extends Syncable {
  name: string
  archived: boolean
}

export type TransactionType = 'expense' | 'income'

export type CategoryId =
  | 'anuong'
  | 'dichuyen'
  | 'muasam'
  | 'hoadon'
  | 'giaitri'
  | 'suckhoe'
  | 'hoctap'
  | 'thunhap'
  | 'khac'

export interface Transaction extends Syncable {
  type: TransactionType
  /** Total amount I paid out / received, integer VND. */
  amount: number
  category: CategoryId
  note: string
  /** YYYY-MM-DD */
  date: string
  rawInput?: string
}

export interface Debt extends Syncable {
  transactionId: string
  friendId: string
  /** The friend's share that I paid for, > 0. */
  amount: number
}

export interface Settlement extends Syncable {
  friendId: string
  /** Amount the friend paid back to me, > 0. */
  amount: number
  date: string
  note: string
  /** Set when the user marked specific debts paid; absent for amount-only settlements. */
  debtIds?: string[]
}

export interface Meta {
  key: string
  value: string
}

export type TransactionWithDebts = Transaction & { debts: Debt[] }

export interface SplitInput {
  friendId: string
  amount: number
}

export interface NewTransaction {
  type: TransactionType
  amount: number
  category: CategoryId
  note: string
  date: string
  rawInput?: string
  splits: SplitInput[]
}

export interface DebtEntry {
  debtId: string
  transactionId: string
  date: string
  note: string
  amount: number
}

export type Language = 'vi' | 'en'
