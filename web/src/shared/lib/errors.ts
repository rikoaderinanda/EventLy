import type { TFunction } from 'i18next'
import { ApiError } from '@/api/problem'

/**
 * A readable message for a failed API call. Looks up `errors.<code>` (dots become underscores,
 * because i18next uses dots for nesting) and falls back to a generic message.
 */
export function errorMessage(t: TFunction, error: unknown): string {
  const code = error instanceof ApiError ? error.code : 'unknown'
  return t(`errors.${code.replaceAll('.', '_')}`, { defaultValue: t('errors.generic') })
}

/** Field errors from a 400 ValidationProblemDetails, keyed by camelCase field name. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || !error.problem?.errors) return {}
  return Object.fromEntries(
    Object.entries(error.problem.errors).map(([field, messages]) => [
      field.charAt(0).toLowerCase() + field.slice(1),
      messages[0] ?? '',
    ]),
  )
}
