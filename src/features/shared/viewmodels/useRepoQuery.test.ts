import { createTestRepositories } from '@/data/testing'
import { renderViewModel, waitFor } from '@/test/renderViewModel'
import { useRepoQuery } from './useRepoQuery'

test('reports loading, then data, and re-runs on db change', async () => {
  const { repos } = createTestRepositories()
  const { result } = renderViewModel(() => useRepoQuery(() => repos.friends.list(), [repos]), repos)
  expect(result.current.isLoading).toBe(true)
  await waitFor(() => expect(result.current.data).toEqual([]))
  await repos.friends.create('Nam')
  await waitFor(() => expect(result.current.data?.map((f) => f.name)).toEqual(['Nam']))
})

test('captures errors instead of throwing', async () => {
  const { repos } = createTestRepositories()
  const { result } = renderViewModel(() => useRepoQuery(() => Promise.reject(new Error('boom')), []), repos)
  await waitFor(() => expect(result.current.error).toBeInstanceOf(Error))
  expect(result.current.isLoading).toBe(false)
})
