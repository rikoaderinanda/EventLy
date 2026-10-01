import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/api/client'
import { eventKeys } from '@/features/events/api'

export type PackageFeatures = {
  maxGuests: number
  maxPhotos: number
  maxStaff: number
  maxAdmins: number
  galleryRetentionDays: number
  zipDownload: boolean
  excelExport: boolean
  guestUploadEnabled: boolean
  maxGuestPhotosPerInvitation: number
  wishesEnabled: boolean
  digitalGiftEnabled: boolean
  backgroundMusicEnabled: boolean
  countdownEnabled: boolean
}

export type Package = {
  id: string
  code: string
  name: string
  price: number
  currency: string
  features: PackageFeatures
  isActive: boolean
}

export type PaymentStatus = 'Pending' | 'Paid' | 'Failed' | 'Expired' | 'Cancelled'
export type PaymentProvider = 'Fake' | 'Xendit' | 'Manual'

export type Payment = {
  id: string
  eventId: string
  packageId: string
  packageName: string
  amount: number
  currency: string
  status: PaymentStatus
  provider: PaymentProvider
  providerReference: string | null
  checkoutUrl: string | null
  expiresAt: string | null
  paidAt: string | null
  note: string | null
  createdAt: string
}

export type Receipt = {
  paymentId: string
  reference: string
  organizationName: string
  organizationEmail: string | null
  ownerName: string
  ownerEmail: string
  eventId: string
  eventName: string
  eventDate: string
  eventTimeZone: string
  packageName: string
  amount: number
  currency: string
  provider: PaymentProvider
  paidAt: string
}

export const paymentKeys = {
  packages: ['packages'] as const,
  forEvent: (eventId: string) => ['events', eventId, 'payments'] as const,
  detail: (id: string) => ['payments', id] as const,
  receipt: (id: string) => ['payments', id, 'receipt'] as const,
}

/** How often the payment page asks for news while the payment is pending. */
export const pollIntervalMs = 3000

export function formatMoney(amount: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(
    amount,
  )
}

export function usePackages(enabled = true) {
  return useQuery({
    queryKey: paymentKeys.packages,
    queryFn: () => apiFetch<Package[]>('/packages'),
    enabled,
    staleTime: 5 * 60 * 1000,
  })
}

export function useEventPayments(eventId: string, enabled: boolean) {
  return useQuery({
    queryKey: paymentKeys.forEvent(eventId),
    queryFn: () => apiFetch<Payment[]>(`/events/${eventId}/payments`),
    enabled,
  })
}

/** Polls while the payment is pending, so the page follows the webhook without a reload. */
export function usePayment(id: string) {
  return useQuery({
    queryKey: paymentKeys.detail(id),
    queryFn: () => apiFetch<Payment>(`/payments/${id}`),
    refetchInterval: (query) => (query.state.data?.status === 'Pending' ? pollIntervalMs : false),
  })
}

export function useReceipt(id: string) {
  return useQuery({
    queryKey: paymentKeys.receipt(id),
    queryFn: () => apiFetch<Receipt>(`/payments/${id}/receipt`),
  })
}

function useInvalidatePayment() {
  const queryClient = useQueryClient()
  return (payment: Payment) => {
    queryClient.setQueryData(paymentKeys.detail(payment.id), payment)
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: paymentKeys.forEvent(payment.eventId) }),
      queryClient.invalidateQueries({ queryKey: eventKeys.detail(payment.eventId), exact: true }),
      queryClient.invalidateQueries({ queryKey: eventKeys.all, exact: true }),
    ])
  }
}

export function useStartCheckout(eventId: string) {
  const invalidate = useInvalidatePayment()
  return useMutation({
    mutationFn: (packageId: string) =>
      apiFetch<Payment>(`/events/${eventId}/payments`, { method: 'POST', body: { packageId } }),
    onSuccess: invalidate,
  })
}

/** Development only (the fake gateway): pretend the Owner paid, or that the payment failed. */
export function useSimulatePayment(id: string) {
  const invalidate = useInvalidatePayment()
  return useMutation({
    mutationFn: (outcome: 'Paid' | 'Failed') =>
      apiFetch<Payment>(`/payments/${id}/simulate`, { method: 'POST', body: { outcome } }),
    onSuccess: invalidate,
  })
}

/** The fake gateway's checkout is a page of this app; a real provider's is an external https URL. */
export function isInternalCheckout(url: string): boolean {
  return url.startsWith('/')
}
