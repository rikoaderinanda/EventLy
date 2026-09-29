/** RFC 7807 ProblemDetails as returned by the EventLy API. */
export type ProblemDetails = {
  type?: string
  title?: string
  status?: number
  detail?: string
  code?: string
  traceId?: string
  errors?: Record<string, string[]>
}

/** Every failed API call surfaces as an ApiError with the backend's stable error code. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly problem: ProblemDetails | undefined

  constructor(status: number, problem?: ProblemDetails) {
    super(problem?.detail ?? problem?.title ?? `Request failed with status ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.code = problem?.code ?? (status === 0 ? 'network.unreachable' : 'http.' + status)
    this.problem = problem
  }
}

export async function toApiError(response: Response): Promise<ApiError> {
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('json')) {
    try {
      return new ApiError(response.status, (await response.json()) as ProblemDetails)
    } catch {
      // Body wasn't valid JSON; fall through to a status-only error.
    }
  }
  return new ApiError(response.status)
}
