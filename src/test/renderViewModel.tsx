import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import type { Repositories } from '@/data/repositories/types'

export function renderViewModel<TProps, TResult>(hook: (props: TProps) => TResult, repos: Repositories, initialProps?: TProps) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter>
      <RepositoryProvider value={repos}>{children}</RepositoryProvider>
    </MemoryRouter>
  )
  return renderHook(hook, { wrapper, initialProps })
}

export { waitFor }
