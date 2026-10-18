import { RouterProvider } from 'react-router'
import { Toaster } from '@/components/ui/sonner'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import type { Repositories } from '@/data/repositories/types'
import { createAppRouter } from './router'

const router = createAppRouter()

export function App({ repositories }: { repositories: Repositories }) {
  return (
    <RepositoryProvider value={repositories}>
      <RouterProvider router={router} />
      <Toaster position="top-center" offset={{ top: 'calc(env(safe-area-inset-top) + 8px)' }} />
    </RepositoryProvider>
  )
}
