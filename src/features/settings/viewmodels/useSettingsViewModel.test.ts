import { act } from '@testing-library/react'
import { createTestRepositories } from '@/data/testing'
import { downloadJson } from '@/lib/download'
import { formatVND } from '@/lib/format'
import { toast } from 'sonner'
import { i18n } from '@/i18n'
import { renderViewModel, waitFor } from '@/test/renderViewModel'
import { useSettingsViewModel } from './useSettingsViewModel'

vi.mock('@/lib/download', () => ({ downloadJson: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

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

test('a settled friend with history cannot be deleted (archive only)', async () => {
  const { view, repos, nam } = await setup()
  await repos.ledger.addSettlement({ friendId: nam, amount: 50000, date: '2026-10-13', note: '' })
  await waitFor(() => expect(view.result.current.state.friends.find((f) => f.id === nam)?.balanceLabel).toBe(formatVND(0)))
  expect(view.result.current.state.friends.find((f) => f.id === nam)?.canDelete).toBe(false)
})

test('friend list starts hidden and toggles', async () => {
  const { view } = await setup()
  const vm = () => view.result.current
  expect(vm().state.friendsExpanded).toBe(false)
  act(() => vm().actions.toggleFriendsList())
  expect(vm().state.friendsExpanded).toBe(true)
  act(() => vm().actions.toggleFriendsList())
  expect(vm().state.friendsExpanded).toBe(false)
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
  expect(downloadJson).toHaveBeenCalledWith(expect.stringMatching(/^personal-expense-note-backup-\d{4}-\d{2}-\d{2}\.json$/), expect.objectContaining({ format: 'personal-expense-note-snapshot' }))
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

test('an invalid backup is rejected before asking to overwrite', async () => {
  const { view } = await setup()
  await act(() => view.result.current.actions.importJson(new File([JSON.stringify({ format: 'nope' })], 'b.json')))
  expect(view.result.current.state.error).toBe('errors.invalidBackup')
  expect(view.result.current.state.confirm).toBeNull()
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

test('reminder template: defaults, save, reset', async () => {
  const { view, repos } = await setup()
  const vm = () => view.result.current
  expect(vm().state.reminderTemplate).toContain('{name}')
  act(() => vm().actions.setReminderTemplate('Hi {name}: {total}'))
  await act(() => vm().actions.saveReminderTemplate())
  expect(await repos.meta.get('reminderTemplate')).toBe('Hi {name}: {total}')
  await act(() => vm().actions.resetReminderTemplate())
  expect(await repos.meta.get('reminderTemplate')).toBe('')
  await waitFor(() => expect(vm().state.reminderTemplate).toContain('tổng kết'))
})

test('load failure is exposed as loadError instead of an endless skeleton', async () => {
  const t = createTestRepositories()
  const repos = { ...t.repos, friends: { ...t.repos.friends, list: () => Promise.reject(new Error('boom')) } }
  const view = renderViewModel(() => useSettingsViewModel(), repos)
  await waitFor(() => expect(view.result.current.state.loadError).toBe(true))
})

test('action errors are also toasted so they are visible anywhere on the page', async () => {
  const { view } = await setup()
  act(() => view.result.current.actions.setNewFriendName('nam'))
  await act(() => view.result.current.actions.addFriend())
  expect(toast.error).toHaveBeenCalledWith('Đã có bạn trùng tên.')
})

describe('sync', () => {
  async function syncSetup() {
    const { createMemorySyncApi } = await import('@/data/sync/memoryApi')
    const api = createMemorySyncApi()
    const t = createTestRepositories({ syncApi: api, isOnline: () => true })
    const view = renderViewModel(() => useSettingsViewModel(), t.repos)
    await waitFor(() => expect(view.result.current.state.isLoading).toBe(false))
    return { ...t, api, view }
  }

  test('starts disabled', async () => {
    const { view } = await syncSetup()
    expect(view.result.current.state.sync.enabled).toBe(false)
    expect(view.result.current.state.sync.code).toBeNull()
  })

  test('createCode enables sync, syncs and shows the time of the last sync', async () => {
    const { view } = await syncSetup()
    await act(() => view.result.current.actions.createCode())
    // The code is saved before the first upload finishes; lastSyncAt lands after it.
    await waitFor(() => expect(view.result.current.state.sync.lastSyncLabel).not.toBeNull())
    const sync = view.result.current.state.sync
    expect(sync.code).toHaveLength(43)
    expect(sync.codeVisible).toBe(false)
    expect(sync.lastSyncLabel).toMatch(/^\d{2}:\d{2}$/)
    expect(sync.statusLabel).toBe(i18n.t('settings.syncSynced', { time: sync.lastSyncLabel }))
  })

  test('joinWithCode with an unknown code shows syncCodeNotFound and stays disabled', async () => {
    const { view } = await syncSetup()
    act(() => view.result.current.actions.setJoinDraft('x'.repeat(43)))
    await act(() => view.result.current.actions.joinWithCode())
    expect(view.result.current.state.error).toBe('errors.syncCodeNotFound')
    expect(view.result.current.state.sync.enabled).toBe(false)
  })

  test('joinWithCode with a code from another device enables sync and clears the draft', async () => {
    const { api, view } = await syncSetup()
    const other = createTestRepositories({ syncApi: api, isOnline: () => true })
    const code = await other.repos.sync.createSecret()
    act(() => view.result.current.actions.setJoinDraft(code))
    await act(() => view.result.current.actions.joinWithCode())
    await waitFor(() => expect(view.result.current.state.sync.code).toBe(code))
    expect(view.result.current.state.sync.joinDraft).toBe('')
  })

  test('disable needs confirmation', async () => {
    const { view } = await syncSetup()
    await act(() => view.result.current.actions.createCode())
    await waitFor(() => expect(view.result.current.state.sync.enabled).toBe(true))
    act(() => view.result.current.actions.askDisableSync())
    expect(view.result.current.state.confirm).toBe('disableSync')
    await act(() => view.result.current.actions.confirm())
    await waitFor(() => expect(view.result.current.state.sync.enabled).toBe(false))
  })

  test('toggleCodeVisible reveals the code', async () => {
    const { view } = await syncSetup()
    await act(() => view.result.current.actions.createCode())
    await waitFor(() => expect(view.result.current.state.sync.enabled).toBe(true))
    act(() => view.result.current.actions.toggleCodeVisible())
    expect(view.result.current.state.sync.codeVisible).toBe(true)
  })
})
