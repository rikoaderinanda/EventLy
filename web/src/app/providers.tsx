import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { SessionBootstrap } from '@/features/auth/SessionBootstrap'
import { createQueryClient } from './queryClient'

const queryClient = createQueryClient()

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionBootstrap>{children}</SessionBootstrap>
    </QueryClientProvider>
  )
}
