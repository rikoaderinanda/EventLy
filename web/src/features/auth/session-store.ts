import { create } from 'zustand'
import type { AuthResponse, CurrentUser } from './types'

type SessionStatus = 'loading' | 'authenticated' | 'anonymous'

type SessionState = {
  status: SessionStatus
  /** Kept in memory only. The refresh token lives in an HttpOnly cookie the page can't read. */
  accessToken: string | null
  user: CurrentUser | null
  signIn: (response: AuthResponse) => void
  signOut: () => void
}

export const useSession = create<SessionState>()((set) => ({
  status: 'loading',
  accessToken: null,
  user: null,
  signIn: (response) =>
    set({ status: 'authenticated', accessToken: response.accessToken, user: response.user }),
  signOut: () => set({ status: 'anonymous', accessToken: null, user: null }),
}))
