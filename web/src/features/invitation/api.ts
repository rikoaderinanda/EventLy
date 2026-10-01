import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/api/client'
import { env } from '@/config/env'
import type { EventCategory, EventStatus, EventTimeZone, LocalDateTime } from '@/features/events/api'
import type { GuestType } from '@/features/guests/api'
import { demo, isDemo } from './demo'
import type { InvitationTheme } from './themes'

export type RsvpStatus = 'Pending' | 'Attending' | 'NotAttending'

export type PublicSession = {
  name: string
  startsAt: string
  endsAt: string
  startsAtLocal: LocalDateTime
  endsAtLocal: LocalDateTime
  venue: string
  mapsUrl: string | null
  isCheckInSession: boolean
}

export type PublicRsvp = { status: RsvpStatus; respondedAt: string | null; isOpen: boolean; closesAt: string }

export type PublicInvitation = {
  guestName: string
  type: GuestType
  numberOfPeople: number
  event: {
    name: string
    category: EventCategory
    description: string | null
    timeZone: EventTimeZone
    status: EventStatus
    coverUrl: string | null
    sessions: PublicSession[]
    theme: InvitationTheme
  }
  rsvp: PublicRsvp
  features: {
    countdown: boolean
    wishes: boolean
    wishesOpen: boolean
    digitalGift: boolean
    backgroundMusic: boolean
  }
  myWish: string | null
  checkedIn: boolean
}

export type PublicWish = { guestName: string; message: string; createdAt: string; isMine: boolean }
export type PublicWishPage = { wishes: PublicWish[]; page: number; hasMore: boolean }

export type GiftAccountKind = 'Bank' | 'EWallet'
export type GiftAccount = {
  kind: GiftAccountKind
  provider: string
  accountNumber: string
  accountHolder: string
}
export type PublicGifts = { accounts: GiftAccount[]; address: string | null; qrisUrl: string | null }

const base = (code: string) => `/public/invitations/${encodeURIComponent(code)}`

export const publicKeys = {
  invitation: (code: string) => ['public', code] as const,
  wishes: (code: string) => ['public', code, 'wishes'] as const,
  gifts: (code: string) => ['public', code, 'gifts'] as const,
}

/** The QR image is public (the code is the credential), so an <img> can load it directly. */
export const publicQrUrl = (code: string) =>
  // The demo shows a sample image: it isn't a real invitation, so there is no QR to scan.
  isDemo(code) ? '/demo-qr.svg' : `${env.apiBaseUrl}${base(code)}/qr?size=480`

export function usePublicInvitation(code: string) {
  return useQuery({
    queryKey: publicKeys.invitation(code),
    queryFn: () =>
      isDemo(code) ? demo.invitation() : apiFetch<PublicInvitation>(base(code), { skipAuthRefresh: true }),
    retry: false,
  })
}

export function useSetRsvp(code: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (status: Exclude<RsvpStatus, 'Pending'>) =>
      isDemo(code)
        ? demo.rsvp(status)
        : apiFetch<PublicRsvp>(`${base(code)}/rsvp`, {
            method: 'PUT',
            body: { status },
            skipAuthRefresh: true,
          }),
    onSuccess: (rsvp) =>
      queryClient.setQueryData<PublicInvitation>(
        publicKeys.invitation(code),
        (old) => old && { ...old, rsvp },
      ),
  })
}

export function usePublicWishes(code: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: publicKeys.wishes(code),
    queryFn: ({ pageParam }) =>
      isDemo(code)
        ? demo.wishes()
        : apiFetch<PublicWishPage>(`${base(code)}/wishes?page=${pageParam}`, { skipAuthRefresh: true }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled,
  })
}

export function useSetWish(code: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (message: string) =>
      isDemo(code)
        ? demo.wish(message)
        : apiFetch<PublicWish>(`${base(code)}/wish`, {
            method: 'PUT',
            body: { message },
            skipAuthRefresh: true,
          }),
    onSuccess: (wish) => {
      queryClient.setQueryData<PublicInvitation>(
        publicKeys.invitation(code),
        (old) => old && { ...old, myWish: wish.message },
      )
      return queryClient.invalidateQueries({ queryKey: publicKeys.wishes(code) })
    },
  })
}

export function usePublicGifts(code: string, enabled: boolean) {
  return useQuery({
    queryKey: publicKeys.gifts(code),
    queryFn: () =>
      isDemo(code) ? demo.gifts() : apiFetch<PublicGifts>(`${base(code)}/gifts`, { skipAuthRefresh: true }),
    enabled,
  })
}

export function useConfirmGift(code: string) {
  return useMutation({
    mutationFn: (body: { senderName: string; amount: number | null; note: string | null }) =>
      isDemo(code)
        ? demo.confirmGift()
        : apiFetch<void>(`${base(code)}/gift-confirmations`, { method: 'POST', body, skipAuthRefresh: true }),
  })
}
