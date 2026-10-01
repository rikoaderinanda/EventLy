import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/api/client'
import type { GuestType, InvitationStatus } from '@/features/guests/api'
import type { GiftAccount, RsvpStatus } from '@/features/invitation/api'

export type RsvpRow = {
  invitationId: string
  guestId: string
  guestName: string
  guestType: GuestType
  numberOfPeople: number
  status: RsvpStatus
  respondedAt: string | null
  openedAt: string | null
  invitationStatus: InvitationStatus
}

export type RsvpSummary = {
  invitations: number
  opened: number
  pending: number
  attending: number
  notAttending: number
  expectedPeople: number
}

export type OrganizerWish = {
  id: string
  invitationId: string
  guestName: string
  message: string
  isHidden: boolean
  createdAt: string
  updatedAt: string
}

export type EventGifts = { accounts: GiftAccount[]; address: string | null }

export type GiftConfirmation = {
  id: string
  invitationId: string
  guestName: string
  senderName: string
  amount: number | null
  note: string | null
  createdAt: string
}

export const responseKeys = {
  rsvps: (eventId: string, status: RsvpStatus | '') => ['events', eventId, 'rsvps', status] as const,
  summary: (eventId: string) => ['events', eventId, 'rsvps', 'summary'] as const,
  wishes: (eventId: string) => ['events', eventId, 'wishes'] as const,
  gifts: (eventId: string) => ['events', eventId, 'gifts'] as const,
  confirmations: (eventId: string) => ['events', eventId, 'gift-confirmations'] as const,
}

export function useRsvps(eventId: string, status: RsvpStatus | '') {
  return useQuery({
    queryKey: responseKeys.rsvps(eventId, status),
    queryFn: () => apiFetch<RsvpRow[]>(`/events/${eventId}/rsvps${status ? `?status=${status}` : ''}`),
    placeholderData: (previous) => previous,
  })
}

export function useRsvpSummary(eventId: string) {
  return useQuery({
    queryKey: responseKeys.summary(eventId),
    queryFn: () => apiFetch<RsvpSummary>(`/events/${eventId}/rsvps/summary`),
  })
}

export function useWishes(eventId: string) {
  return useQuery({
    queryKey: responseKeys.wishes(eventId),
    queryFn: () => apiFetch<OrganizerWish[]>(`/events/${eventId}/wishes`),
  })
}

export function useModerateWish(eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'hide' | 'unhide' | 'delete' }) =>
      action === 'delete'
        ? apiFetch<void>(`/events/${eventId}/wishes/${id}`, { method: 'DELETE' })
        : apiFetch<void>(`/events/${eventId}/wishes/${id}/${action}`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: responseKeys.wishes(eventId) }),
  })
}

export function useEventGifts(eventId: string) {
  return useQuery({
    queryKey: responseKeys.gifts(eventId),
    queryFn: () => apiFetch<EventGifts>(`/events/${eventId}/gifts`),
  })
}

export function useSaveEventGifts(eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (gifts: EventGifts) =>
      apiFetch<EventGifts>(`/events/${eventId}/gifts`, { method: 'PUT', body: gifts }),
    onSuccess: (saved) => queryClient.setQueryData(responseKeys.gifts(eventId), saved),
  })
}

export function useGiftConfirmations(eventId: string) {
  return useQuery({
    queryKey: responseKeys.confirmations(eventId),
    queryFn: () => apiFetch<GiftConfirmation[]>(`/events/${eventId}/gift-confirmations`),
  })
}
