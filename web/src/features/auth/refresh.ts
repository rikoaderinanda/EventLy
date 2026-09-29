import { env } from '@/config/env'
import { useSession } from './session-store'
import type { AuthResponse } from './types'

/** Required by the API on cookie-based calls; a cross-site form can't send it (CSRF protection). */
export const csrfHeaders = { 'X-Requested-With': 'EventLy' } as const

let inFlight: Promise<boolean> | null = null

async function callRefresh(): Promise<boolean> {
  const session = useSession.getState()
  const response = await fetch(`${env.apiBaseUrl}/auth/refresh`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { Accept: 'application/json', ...csrfHeaders },
  }).catch(() => null)

  if (response?.ok) {
    session.signIn((await response.json()) as AuthResponse)
    return true
  }

  const sessionEnded = response?.status === 401 || response?.status === 403
  // A network error, 5xx or 429 doesn't prove the session is over: keep a live session,
  // but don't leave the app stuck in "loading" at startup.
  if (sessionEnded || useSession.getState().status === 'loading') {
    session.signOut()
  }
  return false
}

/**
 * Exchanges the refresh cookie for a new access token. Concurrent callers share one request, and
 * tabs take turns through a Web Lock, so two tabs never rotate the same refresh token at once.
 * Returns false when there is no valid session.
 */
export function refreshSession(): Promise<boolean> {
  inFlight ??= (
    typeof navigator !== 'undefined' && navigator.locks
      ? navigator.locks.request('evently-auth-refresh', callRefresh)
      : callRefresh()
  ).finally(() => {
    inFlight = null
  })
  return inFlight
}
