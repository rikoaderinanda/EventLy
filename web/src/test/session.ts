import { vi } from 'vitest'
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
    // Root never has one; everyone else has finished onboarding unless a test says otherwise.
    organizationId: role === 'Root' ? null : '0192f000-0000-7000-8000-00000000a001',
    permissions: [],
    ...overrides,
  }
}

export function fakeAuthResponse(
  role: UserRole,
  accessToken = 'access-token-1',
  overrides: Partial<CurrentUser> = {},
): AuthResponse {
  return { accessToken, expiresIn: 900, user: fakeUser(role, overrides), isNewUser: false }
}

export function signInAs(role: UserRole, overrides: Partial<CurrentUser> = {}) {
  useSession.getState().signIn(fakeAuthResponse(role, 'access-token-1', overrides))
}

type Route = { method?: string; path: string; response: () => Response }

/** Stubs fetch with a small route table; unknown calls answer 404 so a missing stub is obvious. */
export function stubApi(routes: Route[]) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    const route = routes.find((r) => url.endsWith(r.path) && (r.method ?? 'GET') === method)
    return Promise.resolve(route ? route.response() : jsonResponse({ code: 'test.not_stubbed' }, 404))
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
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
