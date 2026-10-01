import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { changeLocale } from '@/i18n'
import { renderRoute } from '@/test/renderRoute'
import { jsonResponse, resetSession, signInAs, stubApi } from '@/test/session'
import type { PublicInvitation } from './api'

const code = 'abcdefghijklmnopqrstuv'
const base = `/public/invitations/${code}`

const invitation: PublicInvitation = {
  guestName: 'Keluarga Wijaya',
  type: 'Group',
  numberOfPeople: 3,
  event: {
    name: 'Pernikahan Rina & Budi',
    category: 'Wedding',
    description: 'Rina & Budi',
    timeZone: 'Asia/Jakarta',
    status: 'Active',
    coverUrl: null,
    theme: 'Elegant',
    sessions: [
      {
        name: 'Resepsi',
        startsAt: '2099-12-12T04:00:00Z',
        endsAt: '2099-12-12T07:00:00Z',
        startsAtLocal: '2099-12-12T11:00:00',
        endsAtLocal: '2099-12-12T14:00:00',
        venue: 'Gedung Serbaguna',
        mapsUrl: 'https://maps.google.com/?q=x',
        isCheckInSession: true,
      },
    ],
  },
  rsvp: { status: 'Pending', respondedAt: null, isOpen: true, closesAt: '2099-12-12T04:00:00Z' },
  features: { countdown: true, wishes: true, wishesOpen: true, digitalGift: true, backgroundMusic: false },
  myWish: null,
  checkedIn: false,
}

describe('guest invitation page', () => {
  beforeEach(() => {
    changeLocale('id')
    resetSession()
  })

  it('opens from the cover and lets the guest answer the RSVP', async () => {
    const fetchMock = stubApi([
      { path: base, response: () => jsonResponse(invitation) },
      {
        path: `${base}/wishes?page=1`,
        response: () => jsonResponse({ wishes: [], page: 1, hasMore: false }),
      },
      { path: `${base}/gifts`, response: () => jsonResponse({ accounts: [], address: null, qrisUrl: null }) },
      {
        method: 'PUT',
        path: `${base}/rsvp`,
        response: () =>
          jsonResponse({ ...invitation.rsvp, status: 'Attending', respondedAt: '2026-10-01T00:00:00Z' }),
      },
    ])
    renderRoute(`/i/${code}`)

    expect(await screen.findByText('Keluarga Wijaya')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Buka Undangan' }))

    expect(screen.getByRole('heading', { name: 'Pernikahan Rina & Budi' })).toBeInTheDocument()
    expect(screen.getByRole('timer', { name: 'Hitung mundur' })).toBeInTheDocument()
    expect(screen.getByText('Gedung Serbaguna')).toBeInTheDocument()
    expect(screen.getByText('Undangan untuk 3 orang')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'QR undangan Anda' })).toHaveAttribute(
      'src',
      `/api/v1${base}/qr?size=480`,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Saya hadir' }))

    expect(await screen.findByText('Terima kasih, Anda akan hadir.')).toBeInTheDocument()
    const put = fetchMock.mock.calls.find((c) => c[1]?.method === 'PUT')!
    expect(JSON.parse(String(put[1]!.body))).toEqual({ status: 'Attending' })
  })

  it('dresses the page in the event theme', async () => {
    stubApi([
      {
        path: base,
        response: () => jsonResponse({ ...invitation, event: { ...invitation.event, theme: 'Corporate' } }),
      },
      {
        path: `${base}/wishes?page=1`,
        response: () => jsonResponse({ wishes: [], page: 1, hasMore: false }),
      },
      { path: `${base}/gifts`, response: () => jsonResponse({ accounts: [], address: null, qrisUrl: null }) },
    ])
    const { container } = renderRoute(`/i/${code}`)

    await userEvent.click(await screen.findByRole('button', { name: 'Buka Undangan' }))
    const page = container.querySelector<HTMLElement>('[style*="--inv-surface"]')!
    expect(page.style.getPropertyValue('--inv-surface')).toBe('#181b22')
    expect(page.style.colorScheme).toBe('dark')
    // The cover is gone from the accessibility tree once opened: one page heading.
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('says so when the invitation is not found', async () => {
    stubApi([])
    renderRoute(`/i/${code}`)

    expect(await screen.findByRole('heading', { name: 'Undangan tidak ditemukan' })).toBeInTheDocument()
  })

  it('shows wishes as plain text and sends the guest wish', async () => {
    const fetchMock = stubApi([
      { path: base, response: () => jsonResponse(invitation) },
      {
        path: `${base}/wishes?page=1`,
        response: () =>
          jsonResponse({
            wishes: [
              {
                guestName: 'Budi',
                message: '<b>Bahagia</b> selalu',
                createdAt: '2026-10-01T00:00:00Z',
                isMine: false,
              },
            ],
            page: 1,
            hasMore: false,
          }),
      },
      { path: `${base}/gifts`, response: () => jsonResponse({ accounts: [], address: null, qrisUrl: null }) },
      {
        method: 'PUT',
        path: `${base}/wish`,
        response: () =>
          jsonResponse({
            guestName: 'Keluarga Wijaya',
            message: 'Selamat!',
            createdAt: '2026-10-01T00:00:00Z',
            isMine: true,
          }),
      },
    ])
    renderRoute(`/i/${code}`)
    await userEvent.click(await screen.findByRole('button', { name: 'Buka Undangan' }))

    expect(await screen.findByText('<b>Bahagia</b> selalu')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Tulis ucapan & doa'), 'Selamat!')
    await userEvent.click(screen.getByRole('button', { name: 'Kirim ucapan' }))

    await vi.waitFor(() => {
      const put = fetchMock.mock.calls.find((c) => c[1]?.method === 'PUT')
      expect(JSON.parse(String(put![1]!.body))).toEqual({ message: 'Selamat!' })
    })
  })

  it('shows gift accounts and copies the number without spaces', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    stubApi([
      {
        path: base,
        response: () => jsonResponse({ ...invitation, features: { ...invitation.features, wishes: false } }),
      },
      {
        path: `${base}/gifts`,
        response: () =>
          jsonResponse({
            accounts: [
              { kind: 'Bank', provider: 'BSI', accountNumber: '7123 4567 89', accountHolder: 'Rina' },
            ],
            address: 'Jl. Melati 5',
            qrisUrl: null,
          }),
      },
    ])
    renderRoute(`/i/${code}`)
    await userEvent.click(await screen.findByRole('button', { name: 'Buka Undangan' }))

    const account = (await screen.findByText('BSI')).closest('li')!
    expect(within(account).getByText('a.n. Rina')).toBeInTheDocument()
    expect(screen.getByText('Jl. Melati 5')).toBeInTheDocument()
    await userEvent.click(within(account).getByRole('button', { name: 'Salin nomor' }))
    expect(writeText).toHaveBeenCalledWith('7123456789')
  })

  it('works for a signed-in organizer previewing the link too', async () => {
    signInAs('Owner')
    stubApi([
      { path: base, response: () => jsonResponse(invitation) },
      {
        path: `${base}/wishes?page=1`,
        response: () => jsonResponse({ wishes: [], page: 1, hasMore: false }),
      },
      { path: `${base}/gifts`, response: () => jsonResponse({ accounts: [], address: null, qrisUrl: null }) },
    ])
    renderRoute(`/i/${code}`)

    expect(await screen.findByRole('button', { name: 'Buka Undangan' })).toBeInTheDocument()
  })
})
