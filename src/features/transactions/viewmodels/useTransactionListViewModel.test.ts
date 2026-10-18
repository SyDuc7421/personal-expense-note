import { act } from '@testing-library/react'
import { createTestRepositories } from '@/data/testing'
import { formatVND } from '@/lib/format'
import { renderViewModel, waitFor } from '@/test/renderViewModel'
import { useTransactionListViewModel } from './useTransactionListViewModel'

async function seed() {
  const t = createTestRepositories()
  const nam = await t.repos.friends.create('Nam')
  const huy = await t.repos.friends.create('Huy')
  await t.repos.transactions.create({
    type: 'expense', amount: 600000, category: 'anuong', note: 'lẩu', date: '2026-10-12',
    splits: [{ friendId: nam, amount: 150000 }, { friendId: huy, amount: 150000 }],
  })
  await t.repos.transactions.create({ type: 'expense', amount: 35000, category: 'anuong', note: 'cafe', date: '2026-10-12', splits: [] })
  await t.repos.transactions.create({ type: 'income', amount: 500000, category: 'thunhap', note: 'lương', date: '2026-10-11', splits: [] })
  await t.repos.transactions.create({ type: 'expense', amount: 50000, category: 'dichuyen', note: 'grab', date: '2026-09-30', splits: [] })
  return t
}

test('groups by day with myShare totals and debtor badges', async () => {
  const { repos } = await seed()
  const { result } = renderViewModel(() => useTransactionListViewModel({ initialMonth: '2026-10' }), repos)
  await waitFor(() => expect(result.current.state.isLoading).toBe(false))
  const groups = result.current.state.groups
  expect(groups.map((g) => g.date)).toEqual(['2026-10-12', '2026-10-11'])
  expect(groups[0].totalLabel).toBe(formatVND(300000 + 35000))
  const lau = groups[0].items.find((i) => i.note === 'lẩu')!
  expect([...lau.debtorNames].sort()).toEqual(['Huy', 'Nam'])
  expect(lau.amountLabel).toBe(formatVND(600000))
  expect(lau.categoryIcon).toBe('🍜')
  expect(groups[1].items[0].amountLabel).toBe(`+${formatVND(500000)}`)
})

test('filters by type, category and hasDebts; month navigation', async () => {
  const { repos } = await seed()
  const { result } = renderViewModel(() => useTransactionListViewModel({ initialMonth: '2026-10' }), repos)
  await waitFor(() => expect(result.current.state.isLoading).toBe(false))
  act(() => result.current.actions.setFilter({ hasDebts: true }))
  await waitFor(() => expect(result.current.state.groups.flatMap((g) => g.items).map((i) => i.note)).toEqual(['lẩu']))
  act(() => result.current.actions.setFilter({ hasDebts: undefined, type: 'income' }))
  await waitFor(() => expect(result.current.state.groups.flatMap((g) => g.items).map((i) => i.note)).toEqual(['lương']))
  act(() => result.current.actions.setFilter({ type: undefined, category: 'anuong' }))
  await waitFor(() => expect(result.current.state.groups.flatMap((g) => g.items)).toHaveLength(2))
  act(() => {
    result.current.actions.setFilter({ category: undefined })
    result.current.actions.previousMonth()
  })
  await waitFor(() => expect(result.current.state.month).toBe('2026-09'))
  await waitFor(() => expect(result.current.state.groups.flatMap((g) => g.items).map((i) => i.note)).toEqual(['grab']))
})

test('removing a transaction updates the list live', async () => {
  const { repos } = await seed()
  const { result } = renderViewModel(() => useTransactionListViewModel({ initialMonth: '2026-09' }), repos)
  await waitFor(() => expect(result.current.state.groups).toHaveLength(1))
  const id = result.current.state.groups[0].items[0].id
  await repos.transactions.remove(id)
  await waitFor(() => expect(result.current.state.groups).toHaveLength(0))
})

test('opens the edit form from the ?edit= search param', async () => {
  const { repos } = await seed()
  const { result } = renderViewModel(() => useTransactionListViewModel({ initialMonth: '2026-10', initialEdit: 'abc' }), repos)
  expect(result.current.state.formTarget).toBe('abc')
})

test('labels today and yesterday groups', async () => {
  const { repos } = createTestRepositories()
  const now = new Date()
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  await repos.transactions.create({ type: 'expense', amount: 1000, category: 'khac', note: 'a', date: iso(now), splits: [] })
  await repos.transactions.create({ type: 'expense', amount: 1000, category: 'khac', note: 'b', date: iso(yesterday), splits: [] })
  const { result } = renderViewModel(() => useTransactionListViewModel({ initialMonth: iso(now).slice(0, 7) }), repos)
  await waitFor(() => expect(result.current.state.groups.length).toBeGreaterThan(0))
  expect(result.current.state.groups[0].label).toBe('Hôm nay')
  if (yesterday.getMonth() === now.getMonth()) expect(result.current.state.groups[1].label).toBe('Hôm qua')
})
