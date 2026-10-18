import { myShare } from '@/domain/balance'
import { getCategory } from '@/domain/categories'
import { needsReview } from '@/domain/sync/integrity'
import type { CategoryId, TransactionType, TransactionWithDebts } from '@/domain/types'
import { formatVND } from '@/lib/format'

export interface TransactionListItem {
  id: string
  note: string
  categoryId: CategoryId
  categoryIcon: string
  type: TransactionType
  date: string
  amountLabel: string
  debtorNames: string[]
  needsReview: boolean
}

export function toTransactionListItem(tx: TransactionWithDebts, friendNames: Map<string, string>): TransactionListItem {
  return {
    id: tx.id,
    note: tx.note,
    categoryId: tx.category,
    categoryIcon: getCategory(tx.category).icon,
    type: tx.type,
    date: tx.date,
    amountLabel: tx.type === 'income' ? `+${formatVND(tx.amount)}` : formatVND(tx.amount),
    debtorNames: tx.debts.map((d) => friendNames.get(d.friendId) ?? '?').sort((a, b) => a.localeCompare(b, 'vi')),
    needsReview: needsReview(tx),
  }
}

export const expenseShare = (tx: TransactionWithDebts) => (tx.type === 'expense' ? myShare(tx) : 0)

export interface CategoryOption {
  id: CategoryId
  icon: string
}
