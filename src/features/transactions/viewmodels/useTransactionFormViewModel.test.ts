import { act } from '@testing-library/react'
import { createTestRepositories } from '@/data/testing'
import { formatVND } from '@/lib/format'
import { renderViewModel, waitFor } from '@/test/renderViewModel'
import { useTransactionFormViewModel } from './useTransactionFormViewModel'

async function setup() {
  const t = createTestRepositories()
  const nam = await t.repos.friends.create('Nam')
  const huy = await t.repos.friends.create('Huy')
  return { ...t, nam, huy }
}

test('creates a transaction with evenly split friends', async () => {
  const { repos, nam, huy } = await setup()
  const onDone = vi.fn()
  const { result } = renderViewModel(() => useTransactionFormViewModel({ onDone }), repos)
  await waitFor(() => expect(result.current.state.friends).toHaveLength(2))
  act(() => {
    result.current.actions.setField('amount', '600.000')
    result.current.actions.setField('note', 'lẩu')
    result.current.actions.setField('date', '2026-10-12')
  })
  expect(result.current.state.values.category).toBe('anuong')
  act(() => {
    result.current.actions.addSplit()
    result.current.actions.addSplit()
  })
  act(() => {
    result.current.actions.setSplit(0, { friendId: nam })
    result.current.actions.setSplit(1, { friendId: huy })
  })
  act(() => result.current.actions.splitEvenly())
  expect(result.current.state.values.splits.map((s) => s.amount)).toEqual(['200000', '200000'])
  expect(result.current.state.myShareLabel).toBe(formatVND(200000))
  await act(() => result.current.actions.save())
  expect(onDone).toHaveBeenCalled()
  const [tx] = await repos.transactions.listByMonth('2026-10')
  expect(tx.amount).toBe(600000)
  expect(tx.debts.map((d) => d.amount)).toEqual([200000, 200000])
})

test('editing amount below splits shows splitsExceedAmount and does not write', async () => {
  const { repos, nam } = await setup()
  const id = await repos.transactions.create({
    type: 'expense', amount: 600000, category: 'anuong', note: 'lẩu', date: '2026-10-12', splits: [{ friendId: nam, amount: 150000 }],
  })
  const onDone = vi.fn()
  const { result } = renderViewModel(() => useTransactionFormViewModel({ id, onDone }), repos)
  await waitFor(() => expect(result.current.state.values.amount).toBe('600000'))
  expect(result.current.state.values.splits).toEqual([expect.objectContaining({ friendId: nam, amount: '150000' })])
  act(() => result.current.actions.setField('amount', '100000'))
  await act(() => result.current.actions.save())
  expect(result.current.state.errors.form).toBe('errors.splitsExceedAmount')
  expect(onDone).not.toHaveBeenCalled()
  expect((await repos.transactions.get(id))?.amount).toBe(600000)
})

test('validates amount and split friends before saving', async () => {
  const { repos } = await setup()
  const { result } = renderViewModel(() => useTransactionFormViewModel({ onDone: () => {} }), repos)
  await waitFor(() => expect(result.current.state.friends).toHaveLength(2))
  await act(() => result.current.actions.save())
  expect(result.current.state.errors.amount).toBe('errors.invalidAmount')
  act(() => {
    result.current.actions.setField('amount', '50000')
    result.current.actions.addSplit()
  })
  await act(() => result.current.actions.save())
  expect(result.current.state.errors.splits).toBe('errors.splitFriendRequired')
  expect(await repos.transactions.count()).toBe(0)
})

test('delete asks for confirmation then removes', async () => {
  const { repos } = await setup()
  const id = await repos.transactions.create({ type: 'expense', amount: 35000, category: 'anuong', note: 'cafe', date: '2026-10-12', splits: [] })
  const onDone = vi.fn()
  const { result } = renderViewModel(() => useTransactionFormViewModel({ id, onDone }), repos)
  await waitFor(() => expect(result.current.state.isEdit).toBe(true))
  act(() => result.current.actions.askDelete())
  expect(result.current.state.confirmingDelete).toBe(true)
  await act(() => result.current.actions.confirmDelete())
  expect(onDone).toHaveBeenCalled()
  expect(await repos.transactions.get(id)).toBeUndefined()
})

test('editing keeps an archived split friend selectable', async () => {
  const { repos, nam } = await setup()
  const id = await repos.transactions.create({
    type: 'expense', amount: 100000, category: 'anuong', note: 'bún', date: '2026-10-12', splits: [{ friendId: nam, amount: 50000 }],
  })
  await repos.friends.setArchived(nam, true)
  const { result } = renderViewModel(() => useTransactionFormViewModel({ id, onDone: () => {} }), repos)
  await waitFor(() => expect(result.current.state.values.splits).toHaveLength(1))
  await waitFor(() => expect(result.current.state.friends.map((f) => f.name)).toEqual(['Huy', 'Nam']))
})
