import type { Debt, Friend, TransactionWithDebts } from '../types'
import { findDuplicateFriendGroups, needsReview } from './integrity'

const base = { createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', deletedAt: null }
const debt = (amount: number, deletedAt: string | null = null): Debt => ({
  ...base, id: crypto.randomUUID(), transactionId: 't', friendId: 'f', amount, deletedAt,
})
const tx = (amount: number, debts: Debt[]): TransactionWithDebts => ({
  ...base, id: 't', type: 'expense', amount, category: 'anuong', note: '', date: '2026-10-01', debts,
})
const friend = (id: string, name: string, createdAt: string, deletedAt: string | null = null): Friend => ({
  ...base, id, name, createdAt, deletedAt, archived: false,
})

test('needsReview is false when debts equal the amount', () => {
  expect(needsReview(tx(300000, [debt(150000), debt(150000)]))).toBe(false)
})

test('needsReview is true when debts exceed the amount', () => {
  expect(needsReview(tx(300000, [debt(150000), debt(151000)]))).toBe(true)
})

test('needsReview ignores deleted debts', () => {
  expect(needsReview(tx(300000, [debt(300000), debt(1000, '2026-10-02T00:00:00.000Z')]))).toBe(false)
})

test('duplicate groups match names ignoring case, spaces and diacritics, oldest first', () => {
  const groups = findDuplicateFriendGroups([
    friend('b', 'NAM ', '2026-10-02T00:00:00.000Z'),
    friend('a', 'Nam', '2026-10-01T00:00:00.000Z'),
    friend('c', 'Năm', '2026-10-03T00:00:00.000Z'),
    friend('d', 'Huy', '2026-10-01T00:00:00.000Z'),
  ])
  expect(groups.map((g) => g.map((f) => f.id))).toEqual([['a', 'b', 'c']])
})

test('duplicate groups ignore deleted friends', () => {
  expect(findDuplicateFriendGroups([
    friend('a', 'Nam', '2026-10-01T00:00:00.000Z'),
    friend('b', 'Nam', '2026-10-02T00:00:00.000Z', '2026-10-03T00:00:00.000Z'),
  ])).toEqual([])
})
