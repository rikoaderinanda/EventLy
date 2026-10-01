import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventDetail } from '@/features/events/api'
import { changeLocale } from '@/i18n'
import { renderRoute } from '@/test/renderRoute'
import { jsonResponse, signInAs, stubApi } from '@/test/session'
import type { Guest, GuestList } from './api'

const session = (id: string, name: string, isCheckInSession: boolean) => ({
  id,
  name,
  startsAt: '2026-12-12T04:00:00Z',
  endsAt: '2026-12-12T07:00:00Z',
  startsAtLocal: '2026-12-12T11:00:00',
  endsAtLocal: '2026-12-12T14:00:00',
  venue: 'Gedung',
  mapsUrl: null,
  isCheckInSession,
})

const event: EventDetail = {
  id: 'e1',
  name: 'Pernikahan Rina & Budi',
  category: 'Wedding',
  description: null,
  timeZone: 'Asia/Jakarta',
  date: '2026-12-12T04:00:00Z',
  venue: 'Gedung',
  status: 'Active',
  sessions: [session('akad', 'Akad Nikah', false), session('resepsi', 'Resepsi', true)],
  staffCount: 0,
  package: null,
  activatedAt: null,
  createdAt: '',
  updatedAt: '',
  version: 1,
}

const guest: Guest = {
  id: 'g1',
  eventId: 'e1',
  name: 'Keluarga Wijaya',
  phone: '0812 3456 7890',
  email: null,
  guestType: 'Group',
  numberOfPeople: 3,
  sessionIds: ['resepsi'],
  invitation: {
    id: 'i1',
    code: 'abcdefghijklmnopqrstuv',
    url: 'http://localhost/i/abcdefghijklmnopqrstuv',
    status: 'Active',
    openedAt: null,
  },
  rsvp: 'Pending',
  createdAt: '',
}

const list: GuestList = { guests: [guest], total: 1, totalPeople: 3, limit: 150 }

describe('guests and invitations', () => {
  beforeEach(() => {
    changeLocale('id')
    signInAs('Admin')
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:qr') }))
  })

  it('adds a group guest invited to the resepsi only', async () => {
    const fetchMock = stubApi([
      { path: '/events/e1', response: () => jsonResponse(event) },
      { method: 'POST', path: '/events/e1/guests', response: () => jsonResponse(guest, 201) },
      { path: '/events/e1/guests/g1', response: () => jsonResponse(guest) },
      { path: '/invitations/i1/qr?size=512', response: () => new Response(new Blob(['png'])) },
    ])
    renderRoute('/app/events/e1/guests/new')

    await userEvent.type(await screen.findByLabelText('Nama tamu'), 'Keluarga Wijaya')
    await userEvent.type(screen.getByLabelText('Nomor WhatsApp (opsional)'), '0812 3456 7890')
    await userEvent.click(screen.getByRole('radio', { name: 'Rombongan' }))
    await userEvent.clear(screen.getByLabelText('Jumlah orang'))
    await userEvent.type(screen.getByLabelText('Jumlah orang'), '3')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Akad Nikah' }))
    await userEvent.click(screen.getByRole('button', { name: 'Tambah tamu' }))

    expect(await screen.findByRole('heading', { name: 'Undangan' })).toBeInTheDocument()
    const post = fetchMock.mock.calls.find((c) => c[1]?.method === 'POST')!
    expect(JSON.parse(String(post[1]!.body))).toEqual({
      name: 'Keluarga Wijaya',
      phone: '0812 3456 7890',
      email: null,
      guestType: 'Group',
      numberOfPeople: 3,
      sessionIds: ['resepsi'],
    })
    expect(await screen.findByRole('img', { name: 'QR undangan Keluarga Wijaya' })).toHaveAttribute(
      'src',
      'blob:qr',
    )
  })

  it('shows the quota and opens WhatsApp with the ready message', async () => {
    stubApi([
      { path: '/events/e1', response: () => jsonResponse(event) },
      { path: '/events/e1/guests', response: () => jsonResponse(list) },
      {
        path: '/events/e1/whatsapp-template',
        response: () => jsonResponse({ template: 'Halo {nama} {link}', isDefault: true }),
      },
      {
        path: '/invitations/i1/whatsapp-link',
        response: () =>
          jsonResponse({
            url: 'https://wa.me/6281234567890?text=Halo',
            message: 'Halo',
            phone: '6281234567890',
          }),
      },
    ])
    const tab = { location: { href: '' }, close: vi.fn() }
    vi.stubGlobal(
      'open',
      vi.fn(() => tab),
    )
    renderRoute('/app/events/e1/guests')

    expect(await screen.findByText('3 dari 150 tamu · 1 undangan')).toBeInTheDocument()
    const row = screen.getByRole('link', { name: 'Keluarga Wijaya' }).closest('li')!
    expect(within(row).getByText(/Rombongan 3 orang/)).toBeInTheDocument()
    await userEvent.click(within(row).getByRole('button', { name: 'Kirim via WhatsApp' }))

    await vi.waitFor(() => expect(tab.location.href).toBe('https://wa.me/6281234567890?text=Halo'))
  })

  it('prepares invitations before payment but offers no way to send them yet', async () => {
    const unpaid = { ...guest, invitation: { ...guest.invitation, url: null } }
    stubApi([
      { path: '/events/e1', response: () => jsonResponse({ ...event, status: 'Draft' }) },
      { path: '/events/e1/guests', response: () => jsonResponse({ ...list, guests: [unpaid], limit: null }) },
      {
        path: '/events/e1/whatsapp-template',
        response: () => jsonResponse({ template: 'Halo {nama} {link}', isDefault: true }),
      },
    ])
    renderRoute('/app/events/e1/guests')

    const row = (await screen.findByRole('link', { name: 'Keluarga Wijaya' })).closest('li')!
    expect(within(row).getByText('Bisa dikirim setelah acara dibayar')).toBeInTheDocument()
    expect(within(row).queryByRole('button', { name: 'Kirim via WhatsApp' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Tambah tamu' })).toBeInTheDocument()
  })

  it('imports a CSV file and lists the lines to fix when it has mistakes', async () => {
    const fetchMock = stubApi([
      { path: '/events/e1', response: () => jsonResponse(event) },
      { path: '/events/e1/guests', response: () => jsonResponse(list) },
      {
        path: '/events/e1/whatsapp-template',
        response: () => jsonResponse({ template: 'Halo {nama} {link}', isDefault: true }),
      },
      {
        method: 'POST',
        path: '/events/e1/guests/import',
        response: () =>
          jsonResponse({
            imported: 0,
            people: 0,
            errors: [
              { line: 3, name: 'Budi', messages: ['Enter a phone number, for example 0812 3456 7890.'] },
            ],
          }),
      },
    ])
    renderRoute('/app/events/e1/guests')

    await userEvent.click(await screen.findByText('Import tamu dari CSV'))
    const file = new File(['nama\nBudi'], 'tamu.csv', { type: 'text/csv' })
    await userEvent.upload(screen.getByLabelText('File CSV'), file)
    await userEvent.click(screen.getByRole('button', { name: 'Import' }))

    expect(await screen.findByText(/Baris 3 \(Budi\)/)).toBeInTheDocument()
    const post = fetchMock.mock.calls.find((c) => c[1]?.method === 'POST')!
    expect(post[1]!.body).toBeInstanceOf(FormData)
    expect((post[1]!.headers as Record<string, string>)['Content-Type']).toBeUndefined()
  })

  it('revokes an invitation after confirmation', async () => {
    const fetchMock = stubApi([
      { path: '/events/e1', response: () => jsonResponse(event) },
      { path: '/events/e1/guests/g1', response: () => jsonResponse(guest) },
      { path: '/invitations/i1/qr?size=512', response: () => new Response(new Blob(['png'])) },
      { method: 'POST', path: '/invitations/i1/revoke', response: () => jsonResponse({}) },
    ])
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    )
    renderRoute('/app/events/e1/guests/g1')

    await userEvent.click(await screen.findByRole('button', { name: 'Cabut undangan' }))

    expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith('/invitations/i1/revoke'))).toBe(true)
  })

  it('prints a QR sheet with one card per invitation', async () => {
    stubApi([
      { path: '/events/e1', response: () => jsonResponse(event) },
      {
        path: '/events/e1/invitations/qr-sheet',
        response: () =>
          jsonResponse([
            {
              invitationId: 'i1',
              guestName: 'Keluarga Wijaya',
              type: 'Group',
              numberOfPeople: 3,
              url: '',
              svg: '<svg></svg>',
            },
          ]),
      },
    ])
    const print = vi.fn()
    vi.stubGlobal('print', print)
    renderRoute('/app/events/e1/qr-sheet')

    expect(await screen.findByText('Keluarga Wijaya')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cetak / simpan PDF' }))
    expect(print).toHaveBeenCalled()
  })

  it('links the event page to its guests', async () => {
    stubApi([{ path: '/events/e1', response: () => jsonResponse(event) }])
    renderRoute('/app/events/e1')

    expect(await screen.findByRole('link', { name: /Tamu & undangan/ })).toHaveAttribute(
      'href',
      '/app/events/e1/guests',
    )
  })
})
