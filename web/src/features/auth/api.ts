import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/api/client'
import { csrfHeaders } from './refresh'
import { useSession } from './session-store'
import type { AuthConfig, AuthResponse } from './types'

export const authKeys = {
  config: ['auth', 'config'] as const,
}

export function useAuthConfig() {
  return useQuery({
    queryKey: authKeys.config,
    queryFn: () => apiFetch<AuthConfig>('/auth/config', { skipAuthRefresh: true }),
    staleTime: Infinity,
  })
}

export async function signInWithGoogle(idToken: string): Promise<AuthResponse> {
  const response = await apiFetch<AuthResponse>('/auth/google', {
    method: 'POST',
    body: { idToken },
    skipAuthRefresh: true,
  })
  useSession.getState().signIn(response)
  return response
}

/** Development/Testing only (the server refuses it elsewhere). */
export async function devSignIn(email: string, name?: string): Promise<AuthResponse> {
  const response = await apiFetch<AuthResponse>('/auth/dev-sign-in', {
    method: 'POST',
    body: { email, name: name || null },
    skipAuthRefresh: true,
  })
  useSession.getState().signIn(response)
  return response
}

export async function signOut(): Promise<void> {
  try {
    await apiFetch<void>('/auth/logout', { method: 'POST', headers: csrfHeaders, skipAuthRefresh: true })
  } finally {
    useSession.getState().signOut()
  }
}
