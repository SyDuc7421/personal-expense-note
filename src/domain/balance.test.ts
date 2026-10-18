import fc from 'fast-check'
import { ageInDays, allocateSettlements, friendBalance, myShare } from './balance'
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

test('ageInDays counts calendar days to today', () => {
  expect(ageInDays('2026-10-12', new Date(2026, 9, 18, 23, 0))).toBe(6)
  expect(ageInDays('2026-10-18', new Date(2026, 9, 18, 1, 0))).toBe(0)
})

test('friendBalance accepts joined entries without deletedAt', () => {
  expect(friendBalance([{ amount: 150000 }, { amount: 50000 }], [settlement(100000)])).toBe(100000)
})


const paid = (amount: number, debtIds?: string[], date = '2026-10-20', createdAt = base.createdAt) => ({ amount, date, createdAt, debtIds })
const remainingById = (list: { debtId: string; remaining: number }[]) => Object.fromEntries(list.map((e) => [e.debtId, e.remaining]))

test('allocate: amount-only settlements go to the oldest debts first (plain FIFO)', () => {
  const owed = (x: number) => allocateSettlements(entries, x ? [paid(x)] : []).filter((e) => e.remaining > 0)
  expect(owed(100000)).toEqual([{ ...entries[1], remaining: 50000 }, { ...entries[0], remaining: 50000 }])
  expect(owed(0).map((e) => e.remaining)).toEqual([150000, 50000])
  expect(owed(200000)).toEqual([])
  expect(owed(150000)).toEqual([{ ...entries[0], remaining: 50000 }])
})

test('allocate: partial settlement then deleting the oldest debt moves credit to the next debt', () => {
  const owed = (es: DebtEntry[]) => allocateSettlements(es, [paid(100000)]).filter((e) => e.remaining > 0)
  expect(owed([entries[0]])).toEqual([])
  const d3 = { debtId: 'd3', transactionId: 't3', date: '2026-10-16', note: 'x', amount: 80000 }
  expect(owed([entries[0], d3])).toEqual([{ ...d3, remaining: 30000 }])
})

test('allocate: targeted settlement pays the named debt, not the oldest', () => {
  expect(remainingById(allocateSettlements(entries, [paid(50000, ['d2'])]))).toEqual({ d1: 150000, d2: 0 })
})

test('allocate: returns paid debts too, oldest first', () => {
  expect(allocateSettlements(entries, [paid(50000, ['d2'])]).map((e) => e.debtId)).toEqual(['d1', 'd2'])
})

test('allocate: targeted first, then amount-only fifo on the rest', () => {
  expect(remainingById(allocateSettlements(entries, [paid(100000), paid(50000, ['d2'])]))).toEqual({ d1: 50000, d2: 0 })
})

test('allocate: overflow when linked debt was deleted goes to fifo', () => {
  expect(remainingById(allocateSettlements([entries[1]], [paid(50000, ['d2'])]))).toEqual({ d1: 100000 })
})

test('allocate: overflow when linked debt shrank goes to fifo', () => {
  const shrunk = [{ ...entries[0], amount: 30000 }, entries[1]]
  expect(remainingById(allocateSettlements(shrunk, [paid(50000, ['d2'])]))).toEqual({ d1: 130000, d2: 0 })
})

test('allocate: linked debt grew after marking shows the difference', () => {
  const grown = [{ ...entries[0], amount: 80000 }, entries[1]]
  expect(remainingById(allocateSettlements(grown, [paid(50000, ['d2'])]))).toEqual({ d1: 150000, d2: 30000 })
})

test('allocate: property — total remaining = max(0, balance) when nothing is overpaid', () => {
  const entriesArb = fc
    .array(fc.record({ amount: fc.integer({ min: 1000, max: 500000 }), day: fc.integer({ min: 1, max: 28 }) }), { minLength: 1, maxLength: 6 })
    .map((items) => items.map((it, i): DebtEntry => ({
      debtId: `d${i}`, transactionId: `t${i}`, note: '', amount: it.amount, date: `2026-10-${String(it.day).padStart(2, '0')}`,
    })))
  const arb = entriesArb.chain((es) =>
    fc.tuple(
      fc.constant(es),
      fc.array(
        fc.record({
          share: fc.double({ min: 0, max: 1, noNaN: true }),
          targets: fc.option(fc.subarray(es.map((e) => e.debtId), { minLength: 1 }), { nil: undefined }),
        }),
        { maxLength: 4 },
      ),
    ),
  )
  fc.assert(
    fc.property(arb, ([es, raw]) => {
      const total = es.reduce((a, e) => a + e.amount, 0)
      let budget = total
      const settlements = raw.flatMap((r, i) => {
        const amount = Math.floor(budget * r.share)
        if (amount <= 0) return []
        budget -= amount
        return [paid(amount, r.targets, '2026-10-29', `2026-10-29T00:00:0${i}.000Z`)]
      })
      const result = allocateSettlements(es, settlements)
      const settled = settlements.reduce((a, s) => a + s.amount, 0)
      expect(result.reduce((a, e) => a + e.remaining, 0)).toBe(total - settled)
      for (const e of result) {
        expect(e.remaining).toBeGreaterThanOrEqual(0)
        expect(e.remaining).toBeLessThanOrEqual(e.amount)
      }
    }),
  )
})
