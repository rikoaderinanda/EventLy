import { z } from 'zod'

export const locales = ['id', 'en'] as const
export type Locale = (typeof locales)[number]

const envSchema = z.object({
  VITE_API_BASE_URL: z.string().min(1).default('/api/v1'),
  VITE_APP_NAME: z.string().min(1).default('EventLy'),
  VITE_DEFAULT_LOCALE: z.enum(locales).default('id'),
})

export type AppEnv = {
  apiBaseUrl: string
  appName: string
  defaultLocale: Locale
}

/** Validates the Vite build-time variables. An invalid value fails fast at startup. */
export function parseEnv(source: Record<string, unknown>): AppEnv {
  const result = envSchema.safeParse(source)
  if (!result.success) {
    throw new Error(`Invalid environment configuration: ${z.prettifyError(result.error)}`)
  }
  return {
    apiBaseUrl: result.data.VITE_API_BASE_URL.replace(/\/+$/, ''),
    appName: result.data.VITE_APP_NAME,
    defaultLocale: result.data.VITE_DEFAULT_LOCALE,
  }
}

export const env = parseEnv(import.meta.env)
