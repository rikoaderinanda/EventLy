import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/api/client'
import type { EventStatus } from '@/features/events/api'
import type {
  Package,
  PackageFeatures,
  Payment,
  PaymentProvider,
  PaymentStatus,
} from '@/features/payments/api'

export type PlatformOwner = {
  id: string
  name: string
  email: string
  status: 'Invited' | 'Active' | 'Disabled'
  organization: { id: string; name: string; status: 'Active' | 'Suspended' } | null
  purchases: { events: number; paidEvents: number; pendingPayments: number }
  createdAt: string
  lastSignInAt: string | null
}

export type PlatformEvent = {
  id: string
  name: string
  date: string
  timeZone: string
  status: EventStatus
  packageName: string | null
}

export type PlatformPayment = {
  id: string
  eventId: string
  eventName: string
  packageName: string
  amount: number
  currency: string
  status: PaymentStatus
  provider: PaymentProvider
  /** The transfer reference the Owner was asked to write (manual transfers, Q-73). */
  reference: string | null
  paidAt: string | null
  note: string | null
  createdAt: string
}

export type PlatformOwnerDetail = {
  owner: PlatformOwner
  events: PlatformEvent[]
  payments: PlatformPayment[]
}

export type PackageInput = {
  name: string
  price: number
  currency: string
  features: PackageFeatures
  isActive: boolean
}

export const platformKeys = {
  owners: ['platform', 'owners'] as const,
  ownerList: (search: string) => ['platform', 'owners', 'list', search] as const,
  owner: (id: string) => ['platform', 'owners', id] as const,
  packages: ['platform', 'packages'] as const,
}

export function useOwners(search: string) {
  return useQuery({
    queryKey: platformKeys.ownerList(search),
    queryFn: () =>
      apiFetch<PlatformOwner[]>(`/platform/owners${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  })
}

export function useOwner(id: string) {
  return useQuery({
    queryKey: platformKeys.owner(id),
    queryFn: () => apiFetch<PlatformOwnerDetail>(`/platform/owners/${id}`),
  })
}

export function useSuspendOwner() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, suspend }: { id: string; suspend: boolean }) =>
      apiFetch<void>(`/platform/owners/${id}/${suspend ? 'suspend' : 'reactivate'}`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: platformKeys.owners }),
  })
}

/** Root confirms a payment made outside the gateway (bank transfer) and activates the event. */
export function useActivateManually() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      eventId,
      ...body
    }: {
      eventId: string
      packageId: string
      amount: number
      note: string
    }) => apiFetch<Payment>(`/platform/events/${eventId}/activate`, { method: 'POST', body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: platformKeys.owners }),
  })
}

export function useAllPackages() {
  return useQuery({
    queryKey: platformKeys.packages,
    queryFn: () => apiFetch<Package[]>('/platform/packages'),
  })
}

export function useSavePackage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, code, input }: { id: string | null; code: string; input: PackageInput }) =>
      id
        ? apiFetch<Package>(`/platform/packages/${id}`, { method: 'PUT', body: input })
        : apiFetch<Package>('/platform/packages', { method: 'POST', body: { code, ...input } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: platformKeys.packages }),
  })
}
