import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { changeLocale } from '@/i18n'
import { renderRoute } from '@/test/renderRoute'
import { jsonResponse, signInAs, stubApi } from '@/test/session'
import type { EventDetail } from './api'
import { formatLocal, joinLocal } from './format'

const detail: EventDetail = {
  id: 'e1',
  name: 'Pernikahan Rina & Budi',
  category: 'Wedding',
  description: 'Rina & Budi',
  timeZone: 'Asia/Makassar',
  date: '2026-12-12T03:00:00Z',
  venue: 'Gedung Serbaguna',
  status: 'Draft',
  sessions: [
    {
      id: 's1',
      name: 'Akad Nikah',
      startsAt: '2026-12-12T00:00:00Z',
      endsAt: '2026-12-12T02:00:00Z',
      startsAtLocal: '2026-12-12T08:00:00',
      endsAtLocal: '2026-12-12T10:00:00',
      venue: 'Masjid Agung',
      mapsUrl: null,
      isCheckInSession: false,
    },
    {
      id: 's2',
      name: 'Resepsi',
      startsAt: '2026-12-12T03:00:00Z',
      endsAt: '2026-12-12T06:00:00Z',
      startsAtLocal: '2026-12-12T11:00:00',
      endsAtLocal: '2026-12-12T14:00:00',
      venue: 'Gedung Serbaguna',
      mapsUrl: 'https://maps.google.com/?q=x',
      isCheckInSession: true,
    },
  ],
  staffCount: 0,
  package: null,
  activatedAt: null,
  createdAt: '',
  updatedAt: '',
  version: 7,
}

describe('event pages', () => {
  beforeEach(() => {
    changeLocale('id')
  })

  it('creates an event with local session times and exactly one check-in session', async () => {
    signInAs('Admin')
    const fetchMock = stubApi([
      { path: '/events', response: () => jsonResponse([]) },
      { method: 'POST', path: '/events', response: () => jsonResponse(detail, 201) },
      { path: '/events/e1', response: () => jsonResponse(detail) },
    ])
    renderRoute('/app/events/new')

    await userEvent.type(await screen.findByLabelText('Nama acara'), 'Pernikahan Rina & Budi')
    await userEvent.selectOptions(screen.getByLabelText('Zona waktu lokasi'), 'Asia/Makassar')
    const session = screen.getByRole('group', { name: 'Sesi 1' })
    await userEvent.type(within(session).getByLabelText('Tanggal'), '2026-12-12')
    await userEvent.type(within(session).getByLabelText('Mulai'), '11:00')
    await userEvent.type(within(session).getByLabelText('Selesai'), '14:00')
    await userEvent.type(within(session).getByLabelText('Lokasi'), 'Gedung Serbaguna')
    await userEvent.click(screen.getByRole('button', { name: 'Buat acara' }))

    expect(await screen.findByRole('heading', { name: 'Pernikahan Rina & Budi' })).toBeInTheDocument()
    const post = fetchMock.mock.calls.find((c) => c[1]?.method === 'POST')!
    expect(JSON.parse(String(post[1]!.body))).toMatchObject({
      name: 'Pernikahan Rina & Budi',
      category: 'Wedding',
      timeZone: 'Asia/Makassar',
      sessions: [
        {
          name: 'Resepsi',
          startsAtLocal: '2026-12-12T11:00:00',
          endsAtLocal: '2026-12-12T14:00:00',
          venue: 'Gedung Serbaguna',
          isCheckInSession: true,
        },
      ],
    })
  })

  it('shows session times in the venue time zone and the owner-only actions', async () => {
    signInAs('Owner')
    stubApi([
      { path: '/events/e1', response: () => jsonResponse(detail) },
      { path: '/events/e1/staff', response: () => jsonResponse([]) },
      { path: '/users', response: () => jsonResponse([]) },
    ])
    renderRoute('/app/events/e1')

    const resepsi = (await screen.findByText('Resepsi')).closest('li')!
    expect(within(resepsi).getByText(/11[.:]00/)).toHaveTextContent('WITA')
    expect(within(resepsi).getByText('Sesi check-in')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Batalkan acara' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Staff yang bertugas' })).toBeInTheDocument()
  })

  it('hides cancel and staff assignment from an admin', async () => {
    signInAs('Admin')
    stubApi([{ path: '/events/e1', response: () => jsonResponse(detail) }])
    renderRoute('/app/events/e1')

    expect(await screen.findByRole('link', { name: 'Ubah' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Batalkan acara' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Staff yang bertugas' })).not.toBeInTheDocument()
  })

  it('shows staff their assigned events', async () => {
    signInAs('Staff')
    stubApi([
      {
        path: '/events',
        response: () =>
          jsonResponse([
            {
              id: 'e1',
              name: 'Pernikahan Rina & Budi',
              category: 'Wedding',
              timeZone: 'Asia/Jakarta',
              date: '2026-12-12T04:00:00Z',
              venue: 'Gedung Serbaguna',
              status: 'Active',
              coverUrl: null,
              counts: { invitations: 10, people: 25, rsvpAnswered: 4, checkedInPeople: 5 },
            },
          ]),
      },
    ])
    renderRoute('/staff')

    expect(await screen.findByText('Pernikahan Rina & Budi')).toBeInTheDocument()
    expect(screen.getByText(/WIB/)).toBeInTheDocument()
  })
})

describe('local time helpers', () => {
  it('formats the venue-local time as written, whatever the viewer time zone', () => {
    expect(formatLocal('2026-12-12T11:00:00', 'en-GB', false)).toBe('11:00')
  })

  it('joins date and time inputs into a local date-time', () => {
    expect(joinLocal('2026-12-12', '09:30')).toBe('2026-12-12T09:30:00')
  })
})
