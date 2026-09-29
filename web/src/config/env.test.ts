import { describe, expect, it } from 'vitest'
import { parseEnv } from './env'

describe('parseEnv', () => {
  it('applies defaults when variables are missing', () => {
    expect(parseEnv({})).toEqual({ apiBaseUrl: '/api/v1', appName: 'EventLy', defaultLocale: 'id' })
  })

  it('strips a trailing slash from the API base URL', () => {
    expect(parseEnv({ VITE_API_BASE_URL: 'https://example.test/api/v1/' }).apiBaseUrl).toBe(
      'https://example.test/api/v1',
    )
  })

  it('rejects an unsupported locale', () => {
    expect(() => parseEnv({ VITE_DEFAULT_LOCALE: 'fr' })).toThrow(/Invalid environment configuration/)
  })
})
