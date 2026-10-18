import { act } from '@testing-library/react'
import { createTestRepositories } from '@/data/testing'
import { formatVND } from '@/lib/format'
import { renderViewModel, waitFor } from '@/test/renderViewModel'
import { useDebtsViewModel } from './useDebtsViewModel'

const today = new Date(2026, 9, 18)

async function seed() {
  const t = createTestRepositories()
  const [nam, huy, linh, binh] = await Promise.all(['Nam', 'Huy', 'Linh', 'Bình'].map((n) => t.repos.friends.create(n)))
  // Acceptance 1: lẩu 600k split 4 with Nam, Huy, Linh
  await t.repos.transactions.create({
    type: 'expense', amount: 600000, category: 'anuong', note: 'lẩu', date: '2026-09-10',
    splits: [nam, huy, linh].map((friendId) => ({ friendId, amount: 150000 })),
  })
  await t.repos.transactions.create({
    type: 'expense', amount: 400000, category: 'dichuyen', note: 'grab', date: '2026-10-15', splits: [{ friendId: huy, amount: 400000 }],
  })
  await t.repos.ledger.addSettlement({ friendId: binh, amount: 30000, date: '2026-10-16', note: '' })
  return { ...t, nam, huy, linh, binh }
}

test('lists non-zero balances sorted by oldest debt with overdue flag and totals', async () => {
  const { repos, nam, huy, linh, binh } = await seed()
  // Acceptance 2: Nam pays 100k, balance 50k, age still from the hotpot date
  await repos.ledger.addSettlement({ friendId: nam, amount: 100000, date: '2026-10-17', note: '' })
  await repos.ledger.addSettlement({ friendId: linh, amount: 150000, date: '2026-10-17', note: '' })
  const { result } = renderViewModel(() => useDebtsViewModel({ today }), repos)
  await waitFor(() => expect(result.current.state.isLoading).toBe(false))
  const { state } = result.current
  // same age: ties sorted by name
  expect(state.items.map((i) => i.friendId)).toEqual([huy, nam, binh])
  expect(state.items[1]).toMatchObject({ name: 'Nam', balance: 50000, balanceLabel: formatVND(50000), ageDays: 38, isOverdue: true })
  expect(state.items[0]).toMatchObject({ balance: 550000, ageDays: 38 })
  expect(state.items[2]).toMatchObject({ balance: -30000, ageDays: null, isOverdue: false })
  expect(state.totalOwedToMe).toBe(600000)
  expect(state.totalIOwe).toBe(30000)
})

test('sort by amount puts largest balance first', async () => {
  const { repos, huy } = await seed()
  const { result } = renderViewModel(() => useDebtsViewModel({ today }), repos)
  await waitFor(() => expect(result.current.state.isLoading).toBe(false))
  act(() => result.current.actions.setSortBy('amount'))
  expect(result.current.state.sortBy).toBe('amount')
  expect(result.current.state.items[0].friendId).toBe(huy)
})

test('oldest age follows targeted settlements, not plain FIFO', async () => {
  const { repos, huy } = await seed()
  // Paying the newer grab by item leaves the older lẩu unpaid; plain FIFO would have cleared lẩu instead.
  const grab = (await repos.ledger.listDebtEntries(huy)).find((e) => e.note === 'grab')!
  await repos.ledger.addSettlement({ friendId: huy, amount: 400000, date: '2026-10-17', note: '', debtIds: [grab.debtId] })
  const { result } = renderViewModel(() => useDebtsViewModel({ today }), repos)
  await waitFor(() => expect(result.current.state.isLoading).toBe(false))
  expect(result.current.state.items.find((i) => i.friendId === huy)).toMatchObject({ balance: 150000, ageDays: 38 })
})
