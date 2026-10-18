import { monthSpend, percentChange, spendByCategory, totalOwedToMe } from './stats'
import type { TransactionWithDebts } from './types'

const base = { createdAt: '', updatedAt: '', deletedAt: null, note: '', date: '2026-10-01' }
const tx = (amount: number, category: TransactionWithDebts['category'], owed = 0, type: 'expense' | 'income' = 'expense'): TransactionWithDebts => ({
  ...base, id: `${amount}${category}${type}`, type, amount, category,
  debts: owed ? [{ ...base, id: 'd', transactionId: 'x', friendId: 'f', amount: owed }] : [],
})

const txs = [tx(600000, 'anuong', 450000), tx(35000, 'anuong'), tx(50000, 'dichuyen', 50000), tx(100000, 'giaitri'), tx(5000000, 'thunhap', 0, 'income')]

test('monthSpend sums myShare of expenses only', () => {
  expect(monthSpend(txs)).toBe(150000 + 35000 + 0 + 100000)
})

test('spendByCategory groups myShare, sorted desc, zeros dropped', () => {
  expect(spendByCategory(txs)).toEqual([
    { category: 'anuong', total: 185000 },
    { category: 'giaitri', total: 100000 },
  ])
})

test('percentChange', () => {
  expect(percentChange(120, 100)).toBe(20)
  expect(percentChange(50, 100)).toBe(-50)
  expect(percentChange(50, 0)).toBeNull()
})

test('totalOwedToMe sums positive balances', () => {
  expect(totalOwedToMe([50000, -20000, 100000, 0])).toBe(150000)
})
