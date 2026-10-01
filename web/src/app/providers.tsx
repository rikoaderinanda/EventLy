import { QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'motion/react'
import type { ReactNode } from 'react'
import { SessionBootstrap } from '@/features/auth/SessionBootstrap'
import { createQueryClient } from './queryClient'

const queryClient = createQueryClient()

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Animations follow the device's "reduce motion" setting. */}
      <MotionConfig reducedMotion="user">
        <SessionBootstrap>{children}</SessionBootstrap>
      </MotionConfig>
    </QueryClientProvider>
  )
}
