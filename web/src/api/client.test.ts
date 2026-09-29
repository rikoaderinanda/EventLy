import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from './client'
import { ApiError } from './problem'

function jsonResponse(body: unknown, status: number, contentType = 'application/json') {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': contentType } })
}

describe('apiFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('prefixes the API base URL and returns parsed JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ name: 'EventLy' }, 200))
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiFetch('/system/info')).resolves.toEqual({ name: 'EventLy' })
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/system/info', expect.anything())
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
})
