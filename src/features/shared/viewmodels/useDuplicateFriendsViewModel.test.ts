import { act } from '@testing-library/react'
import { createTestRepositories } from '@/data/testing'
import { renderViewModel, waitFor } from '@/test/renderViewModel'
import { useDuplicateFriendsViewModel } from './useDuplicateFriendsViewModel'

test('visible while two friends share a name; merge hides it', async () => {
  const { db, repos } = createTestRepositories()
  await repos.friends.create('Nam')
  const now = new Date().toISOString()
  await db.friends.add({ id: crypto.randomUUID(), name: 'NAM', archived: true, createdAt: now, updatedAt: now, deletedAt: null })
  const { result } = renderViewModel(() => useDuplicateFriendsViewModel(), repos)
  await waitFor(() => expect(result.current.state.visible).toBe(true))

  await act(() => result.current.actions.merge())
  await waitFor(() => expect(result.current.state.visible).toBe(false))
  expect(await repos.friends.list({ includeArchived: true })).toHaveLength(1)
})

test('hidden without duplicates', async () => {
  const { repos } = createTestRepositories()
  await repos.friends.create('Nam')
  await repos.friends.create('Huy')
  const { result } = renderViewModel(() => useDuplicateFriendsViewModel(), repos)
  await new Promise((r) => setTimeout(r, 50))
  expect(result.current.state.visible).toBe(false)
})
