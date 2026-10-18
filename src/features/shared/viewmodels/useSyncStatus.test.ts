import { act } from '@testing-library/react'
import { createMemorySyncApi } from '@/data/sync/memoryApi'
import { createTestRepositories } from '@/data/testing'
import { renderViewModel, waitFor } from '@/test/renderViewModel'
import { useSyncStatus } from './useSyncStatus'

const expense = { type: 'expense', amount: 1000, category: 'khac', note: '', date: '2026-10-01', splits: [] } as const

test('indicator: none when disabled, synced after sync, pending after a write, offline when offline', async () => {
  const net = { online: true }
  const { repos } = createTestRepositories({ syncApi: createMemorySyncApi(), isOnline: () => net.online })
  const { result } = renderViewModel(() => useSyncStatus(), repos)
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  expect(result.current.indicator).toBe('none')

  await act(() => repos.sync.createSecret())
  await waitFor(() => expect(result.current.indicator).toBe('synced'))

  await new Promise((r) => setTimeout(r, 2))
  await act(() => repos.transactions.create({ ...expense, splits: [] }))
  await waitFor(() => expect(result.current.indicator).toBe('pending'))

  await act(() => result.current.syncNow())
  await waitFor(() => expect(result.current.indicator).toBe('synced'))

  net.online = false
  await act(() => result.current.syncNow())
  await waitFor(() => expect(result.current.indicator).toBe('offline'))
})
