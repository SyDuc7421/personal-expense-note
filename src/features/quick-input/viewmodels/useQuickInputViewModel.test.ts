import { act } from '@testing-library/react'
import { createTestRepositories } from '@/data/testing'
import { formatVND } from '@/lib/format'
import { renderViewModel, waitFor } from '@/test/renderViewModel'
import { useQuickInputViewModel } from './useQuickInputViewModel'

const today = new Date(2026, 9, 18)

test('live preview for a split expense with new friends', async () => {
  const { repos } = createTestRepositories()
  await repos.friends.create('Nam')
  const { result } = renderViewModel(() => useQuickInputViewModel({ today }), repos)
  await waitFor(() => expect(result.current.state.isReady).toBe(true))
  act(() => result.current.actions.setText('lẩu 600k /4 @nam @Huy @Linh'))
  expect(result.current.state.error).toBeNull()
  expect(result.current.state.preview).toMatchObject({
    type: 'expense',
    amountLabel: formatVND(600000),
    categoryId: 'anuong',
    debtorNames: ['Nam', 'Huy', 'Linh'],
    eachLabel: formatVND(150000),
    myShareLabel: formatVND(150000),
    newFriendNames: ['Huy', 'Linh'],
  })
})

test('shows a parse error key, nothing for empty text', async () => {
  const { repos } = createTestRepositories()
  const { result } = renderViewModel(() => useQuickInputViewModel({ today }), repos)
  await waitFor(() => expect(result.current.state.isReady).toBe(true))
  expect(result.current.state.error).toBeNull()
  act(() => result.current.actions.setText('cafe'))
  expect(result.current.state.error).toBe('parse.noAmount')
  expect(result.current.state.preview).toBeNull()
  await act(() => result.current.actions.save())
  expect(await repos.transactions.count()).toBe(0)
})

test('save creates missing friends and the transaction, then clears input', async () => {
  const { repos } = createTestRepositories()
  const { result } = renderViewModel(() => useQuickInputViewModel({ today }), repos)
  await waitFor(() => expect(result.current.state.isReady).toBe(true))
  act(() => result.current.actions.setText('lẩu 600k /4 @Nam @Huy @Linh'))
  await act(() => result.current.actions.save())
  expect(result.current.state.text).toBe('')
  const [tx] = await repos.transactions.listByMonth('2026-10')
  expect(tx).toMatchObject({ amount: 600000, note: 'lẩu', category: 'anuong', date: '2026-10-18', rawInput: 'lẩu 600k /4 @Nam @Huy @Linh' })
  const entries = await repos.ledger.listDebtEntries()
  expect(entries.map((e) => e.amount)).toEqual([150000, 150000, 150000])
  expect((await repos.friends.list()).map((f) => f.name).sort()).toEqual(['Huy', 'Linh', 'Nam'])
})
