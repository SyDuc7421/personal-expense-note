import { createTestRepositories } from '@/data/testing'
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
