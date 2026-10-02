import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventDetail } from '@/features/events/api'
import { changeLocale } from '@/i18n'
import { renderRoute } from '@/test/renderRoute'
import { jsonResponse, signInAs, stubApi } from '@/test/session'
import type { Package, Payment, Receipt } from './api'

const features = {
  maxGuests: 500,
  maxPhotos: 1500,
  maxStaff: 5,
  maxAdmins: 2,
  galleryRetentionDays: 90,
  zipDownload: true,
  excelExport: true,
  guestUploadEnabled: true,
  maxGuestPhotosPerInvitation: 5,
  wishesEnabled: true,
  digitalGiftEnabled: true,
  backgroundMusicEnabled: true,
  countdownEnabled: true,
}

const packages: Package[] = [
  { id: 'basic', code: 'BASIC', name: 'Basic', price: 150000, currency: 'IDR', features, isActive: true },
  {
    id: 'premium',
    code: 'PREMIUM',
    name: 'Premium',
    price: 350000,
    currency: 'IDR',
    features,
    isActive: true,
  },
]

const event: EventDetail = {
  id: 'e1',
  name: 'Pernikahan Rina & Budi',
  category: 'Wedding',
  description: null,
  timeZone: 'Asia/Jakarta',
  date: '2026-12-12T04:00:00Z',
  venue: 'Gedung Serbaguna',
  status: 'Draft',
  sessions: [],
  staffCount: 0,
  package: null,
  activatedAt: null,
  createdAt: '',
  updatedAt: '',
  version: 1,
  theme: 'Elegant',
}

const pending: Payment = {
  id: 'p1',
  eventId: 'e1',
  packageId: 'premium',
  packageName: 'Premium',
  amount: 350000,
  currency: 'IDR',
  status: 'Pending',
  provider: 'Fake',
  providerReference: 'fake_p1',
  checkoutUrl: '/app/payments/p1',
  expiresAt: '2026-10-02T00:00:00Z',
  paidAt: null,
  note: null,
  createdAt: '2026-10-01T00:00:00Z',
}

const paid: Payment = { ...pending, status: 'Paid', paidAt: '2026-10-01T00:05:00Z' }

describe('package and payment', () => {
  beforeEach(() => {
    changeLocale('id')
  })

  it('shows the bank transfer details and reference for a manual checkout', async () => {
    signInAs('Owner')
    const manual: Payment = { ...pending, provider: 'Manual', providerReference: 'EVL-1A2B3C4D' }
    stubApi([
      { path: '/payments/p1', response: () => jsonResponse(manual) },
      {
        path: '/payments/p1/transfer',
        response: () =>
          jsonResponse({
            bankName: 'BSI',
            accountNumber: '7123 456 789',
            accountHolder: 'PT EventLy Indonesia',
            confirmationContact: 'WhatsApp 0812 0000 0000',
            reference: 'EVL-1A2B3C4D',
            amount: 350000,
            currency: 'IDR',
            expiresAt: '2026-10-04T00:00:00Z',
          }),
      },
    ])
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderRoute('/app/payments/p1')

    expect(await screen.findByRole('heading', { name: 'Transfer bank' })).toBeInTheDocument()
    expect(screen.getByText('PT EventLy Indonesia')).toBeInTheDocument()
    expect(screen.getAllByText('EVL-1A2B3C4D').length).toBeGreaterThan(0)
    // No simulator and no external checkout link for a bank transfer.
    expect(screen.queryByText('Simulasi pembayaran (khusus development)')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Lanjutkan pembayaran/ })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Salin Nomor rekening' }))
    expect(writeText).toHaveBeenCalledWith('7123456789')
  })

  it('lets the owner choose a package, check out and pay through the simulated checkout', async () => {
    signInAs('Owner')
    const fetchMock = stubApi([
      { path: '/events/e1', response: () => jsonResponse(event) },
      { path: '/events/e1/staff', response: () => jsonResponse([]) },
      { path: '/users', response: () => jsonResponse([]) },
      { path: '/events/e1/payments', response: () => jsonResponse([]) },
      { path: '/packages', response: () => jsonResponse(packages) },
      { method: 'POST', path: '/events/e1/payments', response: () => jsonResponse(pending, 201) },
      { path: '/payments/p1', response: () => jsonResponse(pending) },
      { method: 'POST', path: '/payments/p1/simulate', response: () => jsonResponse(paid) },
    ])
    renderRoute('/app/events/e1')

    await userEvent.click(await screen.findByRole('radio', { name: /Premium/ }))
    await userEvent.click(screen.getByRole('button', { name: /Bayar Premium/ }))

    expect(await screen.findByText('Simulasi pembayaran (khusus development)')).toBeInTheDocument()
    const post = fetchMock.mock.calls.find(
      (c) => String(c[0]).endsWith('/events/e1/payments') && c[1]?.method === 'POST',
    )!
    expect(JSON.parse(String(post[1]!.body))).toEqual({ packageId: 'premium' })

    await userEvent.click(screen.getByRole('button', { name: 'Bayar berhasil' }))

    expect(await screen.findByText('Pembayaran berhasil. Acara Anda sudah aktif.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Lihat kuitansi' })).toHaveAttribute(
      'href',
      '/app/payments/p1/receipt',
    )
  })

  it('shows the open checkout so the owner can continue it', async () => {
    signInAs('Owner')
    stubApi([
      { path: '/events/e1', response: () => jsonResponse({ ...event, status: 'PendingPayment' }) },
      { path: '/events/e1/staff', response: () => jsonResponse([]) },
      { path: '/users', response: () => jsonResponse([]) },
      { path: '/events/e1/payments', response: () => jsonResponse([pending]) },
      { path: '/packages', response: () => jsonResponse(packages) },
    ])
    renderRoute('/app/events/e1')

    expect(await screen.findByText('Pembayaran paket Premium belum selesai.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Lanjutkan pembayaran' })).toHaveAttribute(
      'href',
      '/app/payments/p1',
    )
  })

  it('tells an admin that the owner pays, without loading payments', async () => {
    signInAs('Admin')
    const fetchMock = stubApi([{ path: '/events/e1', response: () => jsonResponse(event) }])
    renderRoute('/app/events/e1')

    expect(
      await screen.findByText('Owner memilih paket dan membayar untuk mengaktifkan acara ini.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('/payments'))).toBe(false)
  })

  it('shows the paid package with its limits', async () => {
    signInAs('Owner')
    stubApi([
      {
        path: '/events/e1',
        response: () =>
          jsonResponse({
            ...event,
            status: 'Active',
            package: { id: 'premium', code: 'PREMIUM', name: 'Premium', features },
          }),
      },
      { path: '/events/e1/staff', response: () => jsonResponse([]) },
      { path: '/users', response: () => jsonResponse([]) },
      { path: '/events/e1/payments', response: () => jsonResponse([paid]) },
    ])
    renderRoute('/app/events/e1')

    expect(await screen.findByText('Paket Premium')).toBeInTheDocument()
    expect(screen.getByText('Hingga 500 tamu')).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
  })

  it('prints the receipt', async () => {
    signInAs('Owner')
    const receipt: Receipt = {
      paymentId: 'p1',
      reference: 'fake_p1',
      organizationName: 'Santoso WO',
      organizationEmail: null,
      ownerName: 'Rina',
      ownerEmail: 'rina@example.test',
      eventId: 'e1',
      eventName: 'Pernikahan Rina & Budi',
      eventDate: '2026-12-12T04:00:00Z',
      eventTimeZone: 'Asia/Jakarta',
      packageName: 'Premium',
      amount: 350000,
      currency: 'IDR',
      provider: 'Manual',
      paidAt: '2026-10-01T00:05:00Z',
    }
    stubApi([{ path: '/payments/p1/receipt', response: () => jsonResponse(receipt) }])
    const print = vi.fn()
    vi.stubGlobal('print', print)
    renderRoute('/app/payments/p1/receipt')

    expect(await screen.findByRole('heading', { name: 'Kuitansi pembayaran' })).toBeInTheDocument()
    expect(screen.getByText('fake_p1')).toBeInTheDocument()
    expect(screen.getByText(/350\.000/)).toBeInTheDocument()
    expect(screen.getByText('Transfer (dikonfirmasi admin EventLy)')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cetak / simpan PDF' }))
    expect(print).toHaveBeenCalled()
  })
})
