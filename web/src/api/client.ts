import { env } from '@/config/env'
import { refreshSession } from '@/features/auth/refresh'
import { useSession } from '@/features/auth/session-store'
import { ApiError, toApiError } from './problem'

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
  /** Set for the auth endpoints themselves, so a 401 there doesn't trigger another refresh. */
  skipAuthRefresh?: boolean
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const { body, headers, skipAuthRefresh, ...rest } = options
  const accessToken = useSession.getState().accessToken

  try {
    return await fetch(`${env.apiBaseUrl}${path}`, {
      ...rest,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0)
  }
}

/**
 * Fetch wrapper for the EventLy API. Paths are relative to VITE_API_BASE_URL.
 * Adds the in-memory access token; on 401 it refreshes the session once and retries.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await send(path, options)

  if (response.status === 401 && !options.skipAuthRefresh && useSession.getState().accessToken) {
    if (await refreshSession()) {
      response = await send(path, options)
    }
  }

  if (!response.ok) {
    throw await toApiError(response)
  }
  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}
