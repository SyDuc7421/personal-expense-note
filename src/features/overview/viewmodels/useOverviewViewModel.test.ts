import { createTestRepositories } from '@/data/testing'
import { formatVND } from '@/lib/format'
import { renderViewModel, waitFor } from '@/test/renderViewModel'
import { useOverviewViewModel } from './useOverviewViewModel'

test('shows the 5 most recent transactions, newest first', async () => {
  const { repos } = createTestRepositories()
  for (let d = 1; d <= 7; d++) {
    await repos.transactions.create({ type: 'expense', amount: d * 1000, category: 'khac', note: `n${d}`, date: `2026-10-0${d}`, splits: [] })
  }
  const { result } = renderViewModel(() => useOverviewViewModel({ today: new Date(2026, 9, 18) }), repos)
  await waitFor(() => expect(result.current.state.isLoading).toBe(false))
  expect(result.current.state.recent.map((r) => r.note)).toEqual(['n7', 'n6', 'n5', 'n4', 'n3'])
  expect(result.current.state.isEmpty).toBe(false)
})

test('empty state when there are no transactions', async () => {
  const { repos } = createTestRepositories()
  const { result } = renderViewModel(() => useOverviewViewModel({ today: new Date(2026, 9, 18) }), repos)
  await waitFor(() => expect(result.current.state.isLoading).toBe(false))
  expect(result.current.state.isEmpty).toBe(true)
})

test('month spend uses myShare, compares with last month, sums what friends owe', async () => {
  const { repos } = createTestRepositories()
  const nam = await repos.friends.create('Nam')
  const huy = await repos.friends.create('Huy')
  const linh = await repos.friends.create('Linh')
  // Acceptance 1: month spend grows by 150k, each friend owes 150k
  await repos.transactions.create({
    type: 'expense', amount: 600000, category: 'anuong', note: 'lẩu', date: '2026-10-12',
    splits: [nam, huy, linh].map((friendId) => ({ friendId, amount: 150000 })),
  })
  await repos.transactions.create({ type: 'expense', amount: 50000, category: 'dichuyen', note: 'grab', date: '2026-10-13', splits: [] })
  await repos.transactions.create({ type: 'expense', amount: 100000, category: 'anuong', note: 'x', date: '2026-09-02', splits: [] })
  await repos.ledger.addSettlement({ friendId: nam, amount: 200000, date: '2026-10-14', note: '' })

  const { result } = renderViewModel(() => useOverviewViewModel({ today: new Date(2026, 9, 18) }), repos)
  await waitFor(() => expect(result.current.state.isLoading).toBe(false))
  const { state } = result.current
  expect(state.monthSpend).toBe(200000)
  expect(state.monthSpendLabel).toBe(formatVND(200000))
  expect(state.changePercent).toBe(100)
  // Nam overpaid (-50k) does not reduce what is "out there"
  expect(state.owedToMe).toBe(300000)
  expect(state.donut.map((d) => [d.category, d.value])).toEqual([['anuong', 150000], ['dichuyen', 50000]])
})
