import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, apiFetchBlob } from '@/api/client'
import type { RsvpStatus } from '@/features/invitation/api'

export type GuestType = 'Individual' | 'Group'
export type InvitationStatus = 'Active' | 'Revoked'

export type InvitationSummary = {
  id: string
  code: string
  /** Null until the event is paid: invitations can't be sent before that (Q-48). */
  url: string | null
  status: InvitationStatus
  openedAt: string | null
}

export type Guest = {
  id: string
  eventId: string
  name: string
  phone: string | null
  email: string | null
  guestType: GuestType
  numberOfPeople: number
  sessionIds: string[]
  invitation: InvitationSummary
  rsvp: RsvpStatus
  createdAt: string
}

export type GuestList = { guests: Guest[]; total: number; totalPeople: number; limit: number | null }

export type GuestInput = {
  name: string
  phone: string | null
  email: string | null
  guestType: GuestType
  numberOfPeople: number
  sessionIds: string[]
}

export type GuestFilter = {
  search: string
  type: GuestType | ''
  status: InvitationStatus | ''
  rsvp: RsvpStatus | ''
}

export type Invitation = InvitationSummary & {
  eventId: string
  type: GuestType
  guest: { id: string; name: string; phone: string | null; guestType: GuestType; numberOfPeople: number }
  createdAt: string
}

export type WhatsAppLink = { url: string; message: string; phone: string | null }
export type WhatsAppTemplate = { template: string; isDefault: boolean }
export type QrSheetItem = {
  invitationId: string
  guestName: string
  type: GuestType
  numberOfPeople: number
  url: string
  svg: string
}

export const guestKeys = {
  list: (eventId: string) => ['events', eventId, 'guests'] as const,
  filtered: (eventId: string, filter: GuestFilter) => ['events', eventId, 'guests', filter] as const,
  detail: (eventId: string, guestId: string) => ['events', eventId, 'guests', guestId] as const,
  template: (eventId: string) => ['events', eventId, 'whatsapp-template'] as const,
  qrSheet: (eventId: string) => ['events', eventId, 'qr-sheet'] as const,
  qr: (invitationId: string, code: string) => ['invitations', invitationId, 'qr', code] as const,
}

function query(filter: GuestFilter): string {
  const params = new URLSearchParams()
  if (filter.search.trim()) params.set('search', filter.search.trim())
  if (filter.type) params.set('type', filter.type)
  if (filter.status) params.set('status', filter.status)
  if (filter.rsvp) params.set('rsvp', filter.rsvp)
  const text = params.toString()
  return text ? `?${text}` : ''
}

export function useGuests(eventId: string, filter: GuestFilter) {
  return useQuery({
    queryKey: guestKeys.filtered(eventId, filter),
    queryFn: () => apiFetch<GuestList>(`/events/${eventId}/guests${query(filter)}`),
    placeholderData: (previous) => previous,
  })
}

export function useGuest(eventId: string, guestId: string) {
  return useQuery({
    queryKey: guestKeys.detail(eventId, guestId),
    queryFn: () => apiFetch<Guest>(`/events/${eventId}/guests/${guestId}`),
  })
}

function useGuestMutation<TInput, TResult>(eventId: string, mutationFn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: guestKeys.list(eventId) }),
  })
}

export function useSaveGuest(eventId: string, guestId: string | null) {
  return useGuestMutation(eventId, (input: GuestInput) =>
    guestId
      ? apiFetch<Guest>(`/events/${eventId}/guests/${guestId}`, { method: 'PUT', body: input })
      : apiFetch<Guest>(`/events/${eventId}/guests`, { method: 'POST', body: input }),
  )
}

export function useDeleteGuest(eventId: string, guestId: string) {
  return useGuestMutation(eventId, () =>
    apiFetch<void>(`/events/${eventId}/guests/${guestId}`, { method: 'DELETE' }),
  )
}

export function useInvitationAction(eventId: string, invitationId: string) {
  return useGuestMutation(eventId, (action: 'regenerate-code' | 'revoke') =>
    apiFetch<Invitation>(`/invitations/${invitationId}/${action}`, { method: 'POST' }),
  )
}

/** Fetches the ready-made wa.me link; the caller opens it. */
export function fetchWhatsAppLink(invitationId: string) {
  return apiFetch<WhatsAppLink>(`/invitations/${invitationId}/whatsapp-link`)
}

/** The QR as an object URL for an <img>. Keyed by code, so a new code loads a new image. */
export function useQrImage(invitationId: string, code: string, enabled: boolean) {
  return useQuery({
    queryKey: guestKeys.qr(invitationId, code),
    queryFn: async () => URL.createObjectURL(await apiFetchBlob(`/invitations/${invitationId}/qr?size=512`)),
    enabled,
    staleTime: Infinity,
  })
}

export function useWhatsAppTemplate(eventId: string) {
  return useQuery({
    queryKey: guestKeys.template(eventId),
    queryFn: () => apiFetch<WhatsAppTemplate>(`/events/${eventId}/whatsapp-template`),
  })
}

export function useSaveWhatsAppTemplate(eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (template: string | null) =>
      apiFetch<WhatsAppTemplate>(`/events/${eventId}/whatsapp-template`, {
        method: 'PUT',
        body: { template },
      }),
    onSuccess: (saved) => queryClient.setQueryData(guestKeys.template(eventId), saved),
  })
}

export function useQrSheet(eventId: string) {
  return useQuery({
    queryKey: guestKeys.qrSheet(eventId),
    queryFn: () => apiFetch<QrSheetItem[]>(`/events/${eventId}/invitations/qr-sheet`),
  })
}
