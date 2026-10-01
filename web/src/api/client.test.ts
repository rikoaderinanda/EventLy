import { describe, expect, it, vi } from 'vitest'
import { useSession } from '@/features/auth/session-store'
import { changeLocale } from '@/i18n'
import { fakeAuthResponse, jsonResponse, signInAs } from '@/test/session'
import { apiFetch } from './client'
import { ApiError } from './problem'

function authHeader(call: unknown[]): string | undefined {
  const init = call[1] as RequestInit | undefined
  return (init?.headers as Record<string, string> | undefined)?.Authorization
}

describe('apiFetch', () => {
  it('prefixes the API base URL and returns parsed JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ name: 'EventLy' }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiFetch('/system/info')).resolves.toEqual({ name: 'EventLy' })
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/system/info', expect.anything())
  })

  it('asks for messages in the app language', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse({})))
    vi.stubGlobal('fetch', fetchMock)
    const language = (call: unknown[]) =>
      ((call[1] as RequestInit).headers as Record<string, string>)['Accept-Language']

    changeLocale('en')
    await apiFetch('/system/info')
    changeLocale('id')
    await apiFetch('/system/info')

    expect(fetchMock.mock.calls.map(language)).toEqual(['en', 'id'])
  })

  it('turns ProblemDetails into an ApiError with the stable code', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(
            { status: 409, title: 'Invitation already checked in', code: 'invitation.already_checked_in' },
            409,
            'application/problem+json',
          ),
        ),
    )

    const error = await apiFetch('/anything').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 409, code: 'invitation.already_checked_in' })
  })

  it('reports a network failure as status 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(apiFetch('/anything')).rejects.toMatchObject({ status: 0, code: 'network.unreachable' })
  })

  it('sends the access token as a Bearer header', async () => {
    signInAs('Owner')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)

    await apiFetch('/auth/me')

    expect(authHeader(fetchMock.mock.calls[0]!)).toBe('Bearer access-token-1')
  })

  it('refreshes once on 401 and retries with the new token', async () => {
    signInAs('Owner')
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/auth/refresh')) {
        return Promise.resolve(jsonResponse(fakeAuthResponse('Owner', 'access-token-2')))
      }
      const auth = (init?.headers as Record<string, string>).Authorization
      return Promise.resolve(
        auth === 'Bearer access-token-2' ? jsonResponse({ ok: true }) : jsonResponse({}, 401),
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiFetch('/events')).resolves.toEqual({ ok: true })
    expect(fetchMock.mock.calls.filter((c) => String(c[0]).endsWith('/auth/refresh'))).toHaveLength(1)
  })

  it('shares one refresh between concurrent 401s', async () => {
    signInAs('Owner')
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/auth/refresh')) {
        return Promise.resolve(jsonResponse(fakeAuthResponse('Owner', 'access-token-2')))
      }
      const auth = (init?.headers as Record<string, string>).Authorization
      return Promise.resolve(auth === 'Bearer access-token-2' ? jsonResponse({}) : jsonResponse({}, 401))
    })
    vi.stubGlobal('fetch', fetchMock)

    await Promise.all([apiFetch('/a'), apiFetch('/b'), apiFetch('/c')])

    expect(fetchMock.mock.calls.filter((c) => String(c[0]).endsWith('/auth/refresh'))).toHaveLength(1)
  })

  it('ends the session when the refresh is rejected', async () => {
    signInAs('Owner')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ code: 'auth.invalid_refresh_token' }, 401)),
    )

    await expect(apiFetch('/events')).rejects.toMatchObject({ status: 401 })
    expect(useSession.getState().status).toBe('anonymous')
    expect(useSession.getState().accessToken).toBeNull()
  })
})
