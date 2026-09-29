import { useEffect, type ReactNode } from 'react'
import { refreshSession } from './refresh'

/** Restores the session from the refresh cookie once, when the app starts. */
export function SessionBootstrap({ children }: { children: ReactNode }) {
  useEffect(() => {
    void refreshSession()
  }, [])

  return children
}
