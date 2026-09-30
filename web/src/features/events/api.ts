import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/api/client'

export type EventCategory = 'Wedding' | 'Corporate' | 'Birthday' | 'Community' | 'Other'
export type EventStatus = 'Draft' | 'PendingPayment' | 'Active' | 'Completed' | 'Cancelled'

export const eventCategories: EventCategory[] = ['Wedding', 'Corporate', 'Birthday', 'Community', 'Other']
export const timeZones = ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'] as const
export type EventTimeZone = (typeof timeZones)[number]

/** Local wall-clock time at the venue, "YYYY-MM-DDTHH:mm:ss" without offset (the server converts it). */
export type LocalDateTime = string

export type EventSession = {
  id: string
  name: string
  startsAt: string
  endsAt: string
  startsAtLocal: LocalDateTime
  endsAtLocal: LocalDateTime
  venue: string
  mapsUrl: string | null
  isCheckInSession: boolean
}

export type EventDetail = {
  id: string
  name: string
  category: EventCategory
  description: string | null
  timeZone: EventTimeZone
  date: string
  venue: string
  status: EventStatus
  sessions: EventSession[]
  staffCount: number
  createdAt: string
  updatedAt: string
  version: number
}

export type EventListItem = Pick<
  EventDetail,
  'id' | 'name' | 'category' | 'timeZone' | 'date' | 'venue' | 'status'
>

export type SessionInput = {
  id: string | null
  name: string
  startsAtLocal: LocalDateTime
  endsAtLocal: LocalDateTime
  venue: string
  mapsUrl: string | null
  isCheckInSession: boolean
}

export type EventInput = {
  name: string
  category: EventCategory
  timeZone: EventTimeZone
  description: string | null
  sessions: SessionInput[]
}

export type EventStaff = { userId: string; name: string; email: string; status: string }

/** Editing is allowed until the event is completed or cancelled. */
export const isEditable = (status: EventStatus) =>
  status === 'Draft' || status === 'PendingPayment' || status === 'Active'

export const eventKeys = {
  all: ['events'] as const,
  detail: (id: string) => ['events', id] as const,
  staff: (id: string) => ['events', id, 'staff'] as const,
}

export function useEvents() {
  return useQuery({ queryKey: eventKeys.all, queryFn: () => apiFetch<EventListItem[]>('/events') })
}

export function useEvent(id: string) {
  return useQuery({ queryKey: eventKeys.detail(id), queryFn: () => apiFetch<EventDetail>(`/events/${id}`) })
}

function useEventMutation<TInput>(mutationFn: (input: TInput) => Promise<EventDetail | void>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: (result) => {
      if (result) queryClient.setQueryData(eventKeys.detail(result.id), result)
      return queryClient.invalidateQueries({ queryKey: eventKeys.all, exact: true })
    },
  })
}

export function useCreateEvent() {
  return useEventMutation((input: EventInput) =>
    apiFetch<EventDetail>('/events', { method: 'POST', body: input }),
  )
}

export function useUpdateEvent(id: string) {
  return useEventMutation((input: EventInput & { version: number }) =>
    apiFetch<EventDetail>(`/events/${id}`, { method: 'PUT', body: input }),
  )
}

export function useEventAction(id: string, action: 'cancel' | 'complete') {
  return useEventMutation(() => apiFetch<EventDetail>(`/events/${id}/${action}`, { method: 'POST' }))
}

export function useDeleteEvent(id: string) {
  return useEventMutation(() => apiFetch<void>(`/events/${id}`, { method: 'DELETE' }))
}

export function useEventStaff(id: string, enabled: boolean) {
  return useQuery({
    queryKey: eventKeys.staff(id),
    queryFn: () => apiFetch<EventStaff[]>(`/events/${id}/staff`),
    enabled,
  })
}

export function useAssignStaff(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userIds: string[]) =>
      apiFetch<EventStaff[]>(`/events/${id}/staff`, { method: 'PUT', body: { userIds } }),
    onSuccess: (staff) => {
      queryClient.setQueryData(eventKeys.staff(id), staff)
      return queryClient.invalidateQueries({ queryKey: eventKeys.detail(id) })
    },
  })
}
