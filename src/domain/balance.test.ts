import { ageInDays, fifoOutstanding, friendBalance, myShare } from './balance'
import type { Debt, DebtEntry, Settlement, TransactionWithDebts } from './types'

const base = { createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', deletedAt: null }
const debt = (id: string, amount: number, deletedAt: string | null = null): Debt => ({
  ...base, id, transactionId: 't', friendId: 'f', amount, deletedAt,
})
const settlement = (amount: number): Settlement => ({ ...base, id: `s${amount}`, friendId: 'f', amount, date: '2026-10-20', note: '' })

test('myShare subtracts non-deleted debts', () => {
  const tx: TransactionWithDebts = {
    ...base, id: 't', type: 'expense', amount: 600000, category: 'anuong', note: 'lẩu', date: '2026-10-12',
    debts: [debt('a', 150000), debt('b', 150000), debt('c', 150000, '2026-10-02T00:00:00.000Z')],
  }
  expect(myShare(tx)).toBe(300000)
})

test('friendBalance = debts - settlements, ignoring tombstones', () => {
  expect(friendBalance([debt('a', 150000), debt('b', 50000, 'x')], [settlement(100000)])).toBe(50000)
  expect(friendBalance([debt('a', 50000)], [settlement(80000)])).toBe(-30000)
})

const entries: DebtEntry[] = [
  { debtId: 'd2', transactionId: 't2', date: '2026-10-15', note: 'grab', amount: 50000 },
  { debtId: 'd1', transactionId: 't1', date: '2026-10-12', note: 'lẩu', amount: 150000 },
]

test('fifo applies settlements to oldest debts first', () => {
  expect(fifoOutstanding(entries, 100000)).toEqual([
    { ...entries[1], remaining: 50000 },
    { ...entries[0], remaining: 50000 },
  ])
  expect(fifoOutstanding(entries, 0).map((e) => e.remaining)).toEqual([150000, 50000])
  expect(fifoOutstanding(entries, 200000)).toEqual([])
  expect(fifoOutstanding(entries, 150000)).toEqual([{ ...entries[0], remaining: 50000 }])
})

test('fifo after debt removed: oldest outstanding shifts to next debt', () => {
  const remaining = fifoOutstanding([entries[0]], 0)
  expect(remaining[0].date).toBe('2026-10-15')
})

test('ageInDays counts calendar days to today', () => {
  expect(ageInDays('2026-10-12', new Date(2026, 9, 18, 23, 0))).toBe(6)
  expect(ageInDays('2026-10-18', new Date(2026, 9, 18, 1, 0))).toBe(0)
})

test('friendBalance accepts joined entries without deletedAt', () => {
  expect(friendBalance([{ amount: 150000 }, { amount: 50000 }], [settlement(100000)])).toBe(100000)
})
