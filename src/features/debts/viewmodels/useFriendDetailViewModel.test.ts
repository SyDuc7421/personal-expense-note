import { act } from '@testing-library/react'
import { toast } from 'sonner'
import { createTestRepositories } from '@/data/testing'
import { formatVND } from '@/lib/format'
import { renderViewModel, waitFor } from '@/test/renderViewModel'
import { useFriendDetailViewModel } from './useFriendDetailViewModel'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const today = new Date(2026, 9, 18)

async function seed() {
  const t = createTestRepositories()
  const nam = await t.repos.friends.create('Nam')
  await t.repos.transactions.create({
    type: 'expense', amount: 600000, category: 'anuong', note: 'lẩu', date: '2026-10-12', splits: [{ friendId: nam, amount: 150000 }],
  })
  await t.repos.transactions.create({
    type: 'expense', amount: 100000, category: 'dichuyen', note: 'grab', date: '2026-10-15', splits: [{ friendId: nam, amount: 50000 }],
  })
  const view = renderViewModel(() => useFriendDetailViewModel(nam, { today }), t.repos)
  await waitFor(() => expect(view.result.current.state.isLoading).toBe(false))
  return { ...t, nam, view }
}

test('shows balance and a newest-first timeline', async () => {
  const { view } = await seed()
  const { state } = view.result.current
  expect(state.name).toBe('Nam')
  expect(state.balanceLabel).toBe(formatVND(200000))
  expect(state.timeline.map((e) => [e.kind, e.note, e.dateLabel])).toEqual([
    ['debt', 'grab', '15/10'],
    ['debt', 'lẩu', '12/10'],
  ])
})

test('settle defaults to full balance, accepts a partial amount and updates live', async () => {
  const { view, nam, repos } = await seed()
  const vm = () => view.result.current
  act(() => vm().actions.openSettle())
  expect(vm().state.settle).toMatchObject({ open: true, amount: '200000' })
  act(() => vm().actions.setSettleAmount('100.000'))
  await act(() => vm().actions.confirmSettle())
  expect(vm().state.settle.open).toBe(false)
  await waitFor(() => expect(vm().state.balance).toBe(100000))
  expect(vm().state.timeline[0]).toMatchObject({ kind: 'settlement', amountLabel: formatVND(100000) })
  expect(vm().state.outstanding.map((o) => [o.note, o.remaining])).toEqual([['lẩu', 50000], ['grab', 50000]])
  expect(await repos.ledger.listSettlements(nam)).toHaveLength(1)
})

test('settle rejects zero / garbage', async () => {
  const { view, repos } = await seed()
  const vm = () => view.result.current
  act(() => vm().actions.openSettle())
  act(() => vm().actions.setSettleAmount('0'))
  await act(() => vm().actions.confirmSettle())
  expect(vm().state.settle.error).toBe('errors.invalidAmount')
  expect(await repos.ledger.listSettlements()).toHaveLength(0)
})

test('unknown friend is notFound', async () => {
  const { repos } = createTestRepositories()
  const { result } = renderViewModel(() => useFriendDetailViewModel('missing', { today }), repos)
  await waitFor(() => expect(result.current.state.isLoading).toBe(false))
  expect(result.current.state.notFound).toBe(true)
})

test('remind copies the FIFO-unpaid items using the saved template', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  const { view, repos, nam } = await seed()
  await repos.ledger.addSettlement({ friendId: nam, amount: 150000, date: '2026-10-16', note: '' })
  await repos.meta.set('reminderTemplate', '{name}|{items}|{total}')
  await waitFor(() => expect(view.result.current.state.balance).toBe(50000))
  await act(() => view.result.current.actions.remind())
  expect(writeText).toHaveBeenCalledWith('Nam|• 15/10 – Grab: 50.000đ|50.000đ')
})

test('remind falls back to the default template', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  const { view } = await seed()
  await act(() => view.result.current.actions.remind())
  expect(writeText.mock.calls[0][0]).toMatch(/^Ê Nam, tổng kết tí nha 😄\n• 12\/10 – Lẩu: 150.000đ\n• 15\/10 – Grab: 50.000đ\nTổng: 200.000đ/)
})

const debtRow = (vm: ReturnType<typeof useFriendDetailViewModel>, note: string) =>
  vm.state.timeline.find((e) => e.kind === 'debt' && e.note === note)!

test('debt rows carry status after a partial amount-only payment', async () => {
  const { view, repos, nam } = await seed()
  await repos.ledger.addSettlement({ friendId: nam, amount: 170000, date: '2026-10-16', note: '' })
  await waitFor(() => expect(view.result.current.state.balance).toBe(30000))
  const vm = view.result.current
  expect(debtRow(vm, 'lẩu')).toMatchObject({ status: 'paid', selectable: false })
  expect(debtRow(vm, 'grab')).toMatchObject({ status: 'partial', remainingLabel: formatVND(30000), selectable: true })
})

test('select mode toggles and only selectable debts can be selected', async () => {
  const { view, repos, nam } = await seed()
  await repos.ledger.addSettlement({ friendId: nam, amount: 150000, date: '2026-10-16', note: '' })
  await waitFor(() => expect(view.result.current.state.balance).toBe(50000))
  const vm = () => view.result.current
  const lau = debtRow(vm(), 'lẩu').id
  const grab = debtRow(vm(), 'grab').id
  act(() => vm().actions.toggleSelectMode())
  expect(vm().state.selection.active).toBe(true)
  act(() => vm().actions.toggleSelected(lau))
  expect(vm().state.selection.ids).toEqual([])
  act(() => vm().actions.toggleSelected(grab))
  expect(vm().state.selection.ids).toEqual([grab])
  act(() => vm().actions.toggleSelected(grab))
  expect(vm().state.selection.ids).toEqual([])
  act(() => vm().actions.toggleSelected(grab))
  act(() => vm().actions.toggleSelectMode())
  expect(vm().state.selection).toEqual({ active: false, ids: [] })
})

test('mark selected paid pays only those debts, exits select mode, offers undo', async () => {
  const { view, repos, nam } = await seed()
  const vm = () => view.result.current
  const grab = debtRow(vm(), 'grab').id
  act(() => vm().actions.toggleSelectMode())
  act(() => vm().actions.toggleSelected(grab))
  await act(() => vm().actions.markSelectedPaid())
  const settlements = await repos.ledger.listSettlements(nam)
  expect(settlements).toHaveLength(1)
  expect(settlements[0]).toMatchObject({ amount: 50000, debtIds: [grab] })
  await waitFor(() => expect(vm().state.balance).toBe(150000))
  expect(debtRow(vm(), 'lẩu').status).toBe('unpaid')
  expect(debtRow(vm(), 'grab').status).toBe('paid')
  expect(vm().state.timeline.find((e) => e.kind === 'settlement')?.note).toBe('Trả: grab')
  expect(vm().state.selection.active).toBe(false)
  const [message, options] = vi.mocked(toast.success).mock.calls.at(-1)!
  expect(message).toBe('Đã đánh dấu 1 khoản đã trả')
  const action = (options as unknown as { action: { onClick: () => void } }).action
  await act(async () => action.onClick())
  await waitFor(() => expect(vm().state.balance).toBe(200000))
  expect(vm().state.timeline.some((e) => e.kind === 'settlement')).toBe(false)
})

test('mark paid on a partial debt uses its remaining', async () => {
  const { view, repos, nam } = await seed()
  await repos.ledger.addSettlement({ friendId: nam, amount: 170000, date: '2026-10-16', note: '' })
  await waitFor(() => expect(view.result.current.state.balance).toBe(30000))
  const vm = () => view.result.current
  act(() => vm().actions.toggleSelectMode())
  act(() => vm().actions.toggleSelected(debtRow(vm(), 'grab').id))
  await act(() => vm().actions.markSelectedPaid())
  expect((await repos.ledger.listSettlements(nam)).at(-1)?.amount).toBe(30000)
  await waitFor(() => expect(vm().state.balance).toBe(0))
})

test('remind selected lists only selected items and stays in select mode', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  const { view } = await seed()
  const vm = () => view.result.current
  act(() => vm().actions.toggleSelectMode())
  act(() => vm().actions.toggleSelected(debtRow(vm(), 'lẩu').id))
  await act(() => vm().actions.remindSelected())
  const text = writeText.mock.calls[0][0] as string
  expect(text).toContain('Lẩu: 150.000đ')
  expect(text).not.toContain('Grab')
  expect(vm().state.selection.active).toBe(true)
})

test('canSelect is false when everything is paid', async () => {
  const { view, repos, nam } = await seed()
  expect(view.result.current.state.canSelect).toBe(true)
  await repos.ledger.addSettlement({ friendId: nam, amount: 200000, date: '2026-10-16', note: '' })
  await waitFor(() => expect(view.result.current.state.canSelect).toBe(false))
})
