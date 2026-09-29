import { env } from '@/config/env'
import { ApiError, toApiError } from './problem'

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown }

/**
 * Thin fetch wrapper for the EventLy API. Paths are relative to VITE_API_BASE_URL.
 * The access token and automatic refresh are added in Phase 2 (identity).
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options
  const init: RequestInit = {
    ...rest,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }

  let response: Response
  try {
    response = await fetch(`${env.apiBaseUrl}${path}`, init)
  } catch {
    throw new ApiError(0)
  }

  if (!response.ok) {
    throw await toApiError(response)
  }
  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}
