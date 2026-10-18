import { myShare } from './balance'
import type { CategoryId, TransactionWithDebts } from './types'

const expenses = (txs: TransactionWithDebts[]) => txs.filter((t) => t.type === 'expense')

/** Total spending I actually bear (spec 5.1: reports use myShare, never amount). */
export function monthSpend(txs: TransactionWithDebts[]): number {
  return expenses(txs).reduce((acc, t) => acc + myShare(t), 0)
}

export function spendByCategory(txs: TransactionWithDebts[]): { category: CategoryId; total: number }[] {
  const totals = new Map<CategoryId, number>()
  for (const t of expenses(txs)) totals.set(t.category, (totals.get(t.category) ?? 0) + myShare(t))
  return [...totals.entries()]
    .filter(([, total]) => total > 0)
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total)
}

/** Whole-number percent change; null when there is nothing to compare against. */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

export function totalOwedToMe(balances: number[]): number {
  return balances.reduce((acc, b) => acc + Math.max(b, 0), 0)
}
