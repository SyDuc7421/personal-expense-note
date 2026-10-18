import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { DebtEntry, Settlement, TransactionWithDebts } from './types'

type Amounted = { amount: number; deletedAt?: string | null }

/** Items without deletedAt (e.g. DebtEntry joins) count as alive. */
const alive = <T extends Amounted>(items: T[]) => items.filter((i) => !i.deletedAt)
const sum = (items: { amount: number }[]) => items.reduce((acc, i) => acc + i.amount, 0)

/** The part of a transaction I actually bear: amount minus what friends owe me for it. */
export function myShare(tx: TransactionWithDebts): number {
  return tx.amount - sum(alive(tx.debts))
}

/** > 0: friend owes me. < 0: I owe the friend. */
export function friendBalance(debts: Amounted[], settlements: Amounted[]): number {
  return sum(alive(debts)) - sum(alive(settlements))
}

export type DebtAllocation = DebtEntry & { remaining: number }

/**
 * All entries oldest-first (date, then debtId) with what is still owed on each.
 * Targeted settlements pay their own debts first; their overflow (debt deleted or shrunk)
 * joins the amount-only settlements in one pool applied FIFO.
 */
export function allocateSettlements(
  entries: DebtEntry[],
  settlements: Pick<Settlement, 'amount' | 'date' | 'createdAt' | 'debtIds'>[],
): DebtAllocation[] {
  const result = [...entries]
    .sort((a, b) => a.date.localeCompare(b.date) || a.debtId.localeCompare(b.debtId))
    .map((e) => ({ ...e, remaining: e.amount }))
  const pay = (debts: DebtAllocation[], credit: number) => {
    for (const d of debts) {
      const used = Math.min(credit, d.remaining)
      d.remaining -= used
      credit -= used
    }
    return credit
  }
  const targeted = settlements
    .filter((s) => s.debtIds)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
  let pool = sum(settlements.filter((s) => !s.debtIds))
  for (const s of targeted) {
    const ids = new Set(s.debtIds)
    pool += pay(result.filter((d) => ids.has(d.debtId)), s.amount)
  }
  pay(result, pool)
  return result
}

export function ageInDays(date: string, today: Date): number {
  return differenceInCalendarDays(today, parseISO(date))
}
