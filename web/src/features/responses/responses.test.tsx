import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventDetail } from '@/features/events/api'
import { changeLocale } from '@/i18n'
import { renderRoute } from '@/test/renderRoute'
import { jsonResponse, signInAs, stubApi } from '@/test/session'

const event: EventDetail = {
  id: 'e1',
  name: 'Pernikahan Rina & Budi',
  category: 'Wedding',
  description: null,
  timeZone: 'Asia/Jakarta',
  date: '2026-12-12T04:00:00Z',
  venue: 'Gedung',
  status: 'Active',
  sessions: [],
  staffCount: 0,
  package: null,
  activatedAt: null,
  createdAt: '',
  updatedAt: '',
  version: 1,
  theme: 'Elegant',
}

describe('organizer responses', () => {
  beforeEach(() => {
    changeLocale('id')
    signInAs('Admin')
  })

  it('shows the rsvp summary and answers', async () => {
    stubApi([
      { path: '/events/e1', response: () => jsonResponse(event) },
      {
        path: '/events/e1/rsvps/summary',
        response: () =>
          jsonResponse({
            invitations: 3,
            opened: 2,
            pending: 1,
            attending: 1,
            notAttending: 1,
            expectedPeople: 4,
          }),
      },
      {
        path: '/events/e1/rsvps',
        response: () =>
          jsonResponse([
            {
              invitationId: 'i1',
              guestId: 'g1',
              guestName: 'Keluarga Wijaya',
              guestType: 'Group',
              numberOfPeople: 4,
              status: 'Attending',
              respondedAt: '2026-10-01T00:00:00Z',
              openedAt: '2026-10-01T00:00:00Z',
              invitationStatus: 'Active',
            },
          ]),
      },
    ])
    renderRoute('/app/events/e1/rsvps')

    const expected = (await screen.findByText('Perkiraan hadir (orang)')).parentElement!
    expect(within(expected).getByText('4')).toBeInTheDocument()
    const row = screen.getByRole('link', { name: 'Keluarga Wijaya' }).closest('li')!
    expect(within(row).getByText('Hadir')).toBeInTheDocument()
  })

  it('hides a wish', async () => {
    const fetchMock = stubApi([
      { path: '/events/e1', response: () => jsonResponse(event) },
      {
        path: '/events/e1/wishes',
        response: () =>
          jsonResponse([
            {
              id: 'w1',
              invitationId: 'i1',
              guestName: 'Budi',
              message: 'Iklan',
              isHidden: false,
              createdAt: '2026-10-01T00:00:00Z',
              updatedAt: '2026-10-01T00:00:00Z',
            },
          ]),
      },
      { method: 'POST', path: '/events/e1/wishes/w1/hide', response: () => jsonResponse(null, 204) },
    ])
    renderRoute('/app/events/e1/wishes')

    await userEvent.click(await screen.findByRole('button', { name: 'Sembunyikan' }))

    await vi.waitFor(() =>
      expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith('/events/e1/wishes/w1/hide'))).toBe(true),
    )
  })

  it('saves gift accounts', async () => {
    const fetchMock = stubApi([
      { path: '/events/e1', response: () => jsonResponse(event) },
      { path: '/events/e1/gifts', response: () => jsonResponse({ accounts: [], address: null }) },
      { path: '/events/e1/gift-confirmations', response: () => jsonResponse([]) },
      {
        method: 'PUT',
        path: '/events/e1/gifts',
        response: () => jsonResponse({ accounts: [], address: null }),
      },
    ])
    renderRoute('/app/events/e1/gifts')

    await userEvent.click(await screen.findByRole('button', { name: 'Tambah rekening' }))
    const account = screen.getByRole('group', { name: 'Rekening 1' })
    await userEvent.type(within(account).getByLabelText('Bank / e-wallet'), 'BSI')
    await userEvent.type(within(account).getByLabelText('Nomor rekening / HP'), '7123456789')
    await userEvent.type(within(account).getByLabelText('Atas nama'), 'Rina')
    await userEvent.type(screen.getByLabelText('Alamat kirim hadiah (opsional)'), 'Jl. Melati 5')
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }))

    const put = fetchMock.mock.calls.find((c) => c[1]?.method === 'PUT')!
    expect(JSON.parse(String(put[1]!.body))).toEqual({
      accounts: [{ kind: 'Bank', provider: 'BSI', accountNumber: '7123456789', accountHolder: 'Rina' }],
      address: 'Jl. Melati 5',
    })
  })

  it('links the event page to its guest responses', async () => {
    stubApi([{ path: '/events/e1', response: () => jsonResponse(event) }])
    renderRoute('/app/events/e1')

    expect(await screen.findByRole('link', { name: /Monitor RSVP/ })).toHaveAttribute(
      'href',
      '/app/events/e1/rsvps',
    )
    expect(screen.getByRole('link', { name: /Ucapan & doa/ })).toHaveAttribute(
      'href',
      '/app/events/e1/wishes',
    )
    expect(screen.getByRole('link', { name: /Amplop digital/ })).toHaveAttribute(
      'href',
      '/app/events/e1/gifts',
    )
  })
})
