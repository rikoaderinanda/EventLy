import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/api/client'
import type { GuestType } from '@/features/guests/api'
import type { RsvpStatus } from '@/features/invitation/api'

export type CheckInWarning = 'not_invited_to_check_in_session' | 'rsvp_not_attending'

export type CheckInResult = {
  invitationId: string
  guestName: string
  type: GuestType
  numberOfPeople: number
  rsvp: RsvpStatus
  alreadyCheckedIn: boolean
  checkedInAt: string | null
  checkedInBy: string | null
  warnings: CheckInWarning[]
}

export type CheckInSearchItem = {
  invitationId: string
  guestName: string
  type: GuestType
  numberOfPeople: number
  checkedIn: boolean
}

export type CheckInSummary = {
  invitations: number
  people: number
  checkedInInvitations: number
  checkedInPeople: number
}

export type CheckInLogItem = {
  id: string
  invitationId: string
  guestName: string
  numberOfPeople: number
  checkedInAt: string
  staffId: string
  staffName: string
  method: 'Scan' | 'Manual'
}

/** What the scanner read (the invitation URL or a typed code), or a guest picked by name. */
export type CheckInTarget = { code: string } | { invitationId: string }

export const checkInKeys = {
  summary: (eventId: string) => ['events', eventId, 'check-ins', 'summary'] as const,
  log: (eventId: string) => ['events', eventId, 'check-ins', 'log'] as const,
  mine: (eventId: string) => ['events', eventId, 'check-ins', 'mine'] as const,
  search: (eventId: string, q: string) => ['events', eventId, 'check-ins', 'search', q] as const,
}

export function lookup(eventId: string, code: string) {
  return apiFetch<CheckInResult>(`/events/${eventId}/check-ins/lookup?code=${encodeURIComponent(code)}`)
}

export function useCheckIn(eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (target: CheckInTarget) =>
      apiFetch<CheckInResult>(`/events/${eventId}/check-ins`, {
        method: 'POST',
        body:
          'code' in target
            ? { code: target.code, invitationId: null }
            : { code: null, invitationId: target.invitationId },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events', eventId, 'check-ins'] }),
  })
}

export function useCheckInSummary(eventId: string) {
  return useQuery({
    queryKey: checkInKeys.summary(eventId),
    queryFn: () => apiFetch<CheckInSummary>(`/events/${eventId}/check-ins/summary`),
    refetchInterval: 15_000,
  })
}

export function useCheckInSearch(eventId: string, q: string) {
  return useQuery({
    queryKey: checkInKeys.search(eventId, q),
    queryFn: () =>
      apiFetch<CheckInSearchItem[]>(`/events/${eventId}/check-ins/search?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length >= 2,
    placeholderData: (previous) => previous,
  })
}

export function useMyActivity(eventId: string, enabled: boolean) {
  return useQuery({
    queryKey: checkInKeys.mine(eventId),
    queryFn: () => apiFetch<CheckInLogItem[]>(`/staff/me/activity?eventId=${eventId}`),
    enabled,
  })
}

export function useCheckInLog(eventId: string) {
  return useQuery({
    queryKey: checkInKeys.log(eventId),
    queryFn: () => apiFetch<CheckInLogItem[]>(`/events/${eventId}/check-ins`),
    refetchInterval: 30_000,
  })
}
