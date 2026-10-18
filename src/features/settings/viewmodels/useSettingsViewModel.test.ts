import { act } from '@testing-library/react'
import { createTestRepositories } from '@/data/testing'
import { downloadJson } from '@/lib/download'
import { formatVND } from '@/lib/format'
import { i18n } from '@/i18n'
import { renderViewModel, waitFor } from '@/test/renderViewModel'
import { useSettingsViewModel } from './useSettingsViewModel'

vi.mock('@/lib/download', () => ({ downloadJson: vi.fn() }))

async function setup() {
  const t = createTestRepositories()
  const nam = await t.repos.friends.create('Nam')
  await t.repos.friends.create('Huy')
  await t.repos.transactions.create({
    type: 'expense', amount: 100000, category: 'anuong', note: 'bún', date: '2026-10-12', splits: [{ friendId: nam, amount: 50000 }],
  })
  const view = renderViewModel(() => useSettingsViewModel(), t.repos)
  await waitFor(() => expect(view.result.current.state.isLoading).toBe(false))
  return { ...t, nam, view }
}

test('lists friends with balance and deletability', async () => {
  const { view } = await setup()
  expect(view.result.current.state.friends.map((f) => [f.name, f.balanceLabel, f.canDelete])).toEqual([
    ['Huy', formatVND(0), true],
    ['Nam', formatVND(50000), false],
  ])
})

test('adding a duplicate friend sets an error; adding a new one clears the input', async () => {
  const { view, repos } = await setup()
  const vm = () => view.result.current
  act(() => vm().actions.setNewFriendName('nam'))
  await act(() => vm().actions.addFriend())
  expect(vm().state.error).toBe('errors.duplicateName')
  act(() => vm().actions.setNewFriendName('Linh'))
  await act(() => vm().actions.addFriend())
  expect(vm().state.error).toBeNull()
  expect(vm().state.newFriendName).toBe('')
  expect((await repos.friends.list()).map((f) => f.name)).toContain('Linh')
})

test('rename and archive', async () => {
  const { view, repos, nam } = await setup()
  const vm = () => view.result.current
  act(() => vm().actions.startEdit(nam))
  act(() => vm().actions.setEditName('Nam Lê'))
  await act(() => vm().actions.saveEdit())
  expect((await repos.friends.get(nam))?.name).toBe('Nam Lê')
  await act(() => vm().actions.toggleArchive(nam))
  expect((await repos.friends.get(nam))?.archived).toBe(true)
  await waitFor(() => expect(vm().state.friends.find((f) => f.id === nam)?.archived).toBe(true))
})

test('export downloads backup and records lastExportAt', async () => {
  const { view, repos } = await setup()
  await act(() => view.result.current.actions.exportJson())
  expect(downloadJson).toHaveBeenCalledWith(expect.stringMatching(/^ghi-so-backup-\d{4}-\d{2}-\d{2}\.json$/), expect.objectContaining({ format: 'ghi-so-snapshot' }))
  expect(await repos.meta.get('lastExportAt')).toBeTruthy()
})

test('import asks for confirmation then replaces all data', async () => {
  const other = createTestRepositories()
  await other.repos.friends.create('Bình')
  const snapshot = await other.repos.backup.exportSnapshot()
  const { view, repos } = await setup()
  const vm = () => view.result.current
  await act(() => vm().actions.importJson(new File([JSON.stringify(snapshot)], 'b.json')))
  expect(vm().state.confirm).toBe('import')
  await act(() => vm().actions.confirm())
  expect((await repos.friends.list()).map((f) => f.name)).toEqual(['Bình'])
})

test('import of a non-JSON file shows invalidBackup', async () => {
  const { view } = await setup()
  await act(() => view.result.current.actions.importJson(new File(['nope'], 'b.json')))
  expect(view.result.current.state.error).toBe('errors.invalidBackup')
  expect(view.result.current.state.confirm).toBeNull()
})

test('clear all needs two confirmations', async () => {
  const { view, repos } = await setup()
  const vm = () => view.result.current
  act(() => vm().actions.askClear())
  expect(vm().state.confirm).toBe('clear1')
  await act(() => vm().actions.confirm())
  expect(vm().state.confirm).toBe('clear2')
  expect(await repos.transactions.count()).toBe(1)
  await act(() => vm().actions.confirm())
  expect(await repos.transactions.count()).toBe(0)
})

test('setLanguage switches i18n and persists to meta', async () => {
  const { view, repos } = await setup()
  await act(() => view.result.current.actions.setLanguage('en'))
  expect(i18n.language).toBe('en')
  expect(await repos.meta.get('language')).toBe('en')
  await act(() => view.result.current.actions.setLanguage('vi'))
})
