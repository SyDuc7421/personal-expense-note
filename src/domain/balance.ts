import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { Debt, DebtEntry, Settlement, TransactionWithDebts } from './types'

const alive = <T extends { deletedAt: string | null }>(items: T[]) => items.filter((i) => i.deletedAt === null)
const sum = (items: { amount: number }[]) => items.reduce((acc, i) => acc + i.amount, 0)

/** The part of a transaction I actually bear: amount minus what friends owe me for it. */
export function myShare(tx: TransactionWithDebts): number {
  return tx.amount - sum(alive(tx.debts))
}

/** > 0: friend owes me. < 0: I owe the friend. */
export function friendBalance(debts: Debt[], settlements: Settlement[]): number {
  return sum(alive(debts)) - sum(alive(settlements))
}

/** Applies the settled total to the oldest debts first; returns debts not fully paid, oldest first. */
export function fifoOutstanding(entries: DebtEntry[], settledTotal: number): (DebtEntry & { remaining: number })[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.debtId.localeCompare(b.debtId))
  let credit = settledTotal
  const result: (DebtEntry & { remaining: number })[] = []
  for (const entry of sorted) {
    const used = Math.min(credit, entry.amount)
    credit -= used
    if (entry.amount - used > 0) result.push({ ...entry, remaining: entry.amount - used })
  }
  return result
}

export function ageInDays(date: string, today: Date): number {
  return differenceInCalendarDays(today, parseISO(date))
}
