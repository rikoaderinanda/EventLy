import { useSession } from '@/features/auth/session-store'
import type { AuthResponse, CurrentUser, UserRole } from '@/features/auth/types'

export function fakeUser(role: UserRole, overrides: Partial<CurrentUser> = {}): CurrentUser {
  return {
    id: '0192f000-0000-7000-8000-000000000001',
    name: 'Rina',
    email: 'rina@example.test',
    avatarUrl: null,
    role,
    status: 'Active',
    organizationId: null,
    permissions: [],
    ...overrides,
  }
}

export function fakeAuthResponse(role: UserRole, accessToken = 'access-token-1'): AuthResponse {
  return { accessToken, expiresIn: 900, user: fakeUser(role), isNewUser: false }
}

export function signInAs(role: UserRole) {
  useSession.getState().signIn(fakeAuthResponse(role))
}

export function resetSession() {
  useSession.setState({ status: 'anonymous', accessToken: null, user: null })
}

export function jsonResponse(body: unknown, status = 200, contentType = 'application/json') {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': contentType },
  })
}
