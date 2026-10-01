import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventListItem, EventStats } from '@/features/events/api'
import { changeLocale } from '@/i18n'
import { renderRoute } from '@/test/renderRoute'
import { jsonResponse, signInAs, stubApi } from '@/test/session'

const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()

const event = (id: string, name: string, status: EventListItem['status'], date = soon): EventListItem => ({
  id,
  name,
  category: 'Wedding',
  timeZone: 'Asia/Jakarta',
  date,
  venue: 'Gedung Serbaguna',
  status,
  coverUrl: null,
  counts: { invitations: 120, people: 250, rsvpAnswered: 90, checkedInPeople: 0 },
})

const stats: EventStats = {
  eventId: 'e1',
  guests: { invitations: 120, people: 250, peopleLimit: 500, opened: 100 },
  rsvp: { attending: 80, notAttending: 10, pending: 30, attendingPeople: 182 },
  checkIns: {
    invitations: 40,
    people: 96,
    byHour: [
      { hour: '2026-12-12T03:00:00Z', people: 30 },
      { hour: '2026-12-12T04:00:00Z', people: 66 },
    ],
  },
  wishes: 34,
  gifts: { confirmations: 12, amount: 3_500_000 },
  photos: { count: 210, limit: 1500 },
  staff: 3,
}

describe('organizer dashboard', () => {
  beforeEach(() => {
    changeLocale('id')
  })

  it('greets, shows the event in focus with quick actions and its numbers', async () => {
    signInAs('Owner', { name: 'Sarah Wijaya' })
    stubApi([
      {
        path: '/events',
        response: () =>
          jsonResponse([
            event('e1', 'Resepsi Rina & Budi', 'Active'),
            event('e2', 'Ulang Tahun Uni', 'Draft'),
          ]),
      },
      { path: '/events/e1/stats', response: () => jsonResponse(stats) },
    ])
    renderRoute('/app')

    expect(await screen.findByRole('heading', { level: 1, name: /Halo, Sarah/ })).toBeInTheDocument()
    expect(await screen.findByText('1 acara aktif minggu ini')).toBeInTheDocument()
    // The only Active event is the hero.
    expect(screen.getByRole('heading', { level: 2, name: 'Resepsi Rina & Budi' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Kelola tamu' })).toHaveAttribute('href', '/app/events/e1/guests')
    expect(screen.getByRole('link', { name: 'Scan check-in' })).toHaveAttribute('href', '/staff/events/e1')

    const guests = (await screen.findByText('Total tamu')).closest('div.rounded-2xl') as HTMLElement
    expect(within(guests).getByText('250')).toBeInTheDocument()
    expect(within(guests).getByText('dari kuota 500')).toBeInTheDocument()
    // Hero bar, the RSVP card's ring and the other event's card: all 90 of 120 answered in this data.
    const rsvp = screen.getAllByRole('progressbar', { name: 'RSVP terjawab' })
    expect(rsvp).toHaveLength(3)
    rsvp.forEach((bar) => expect(bar).toHaveAttribute('aria-valuenow', '90'))
    // The other event is listed below.
    expect(screen.getByRole('link', { name: /Ulang Tahun Uni/ })).toHaveAttribute('href', '/app/events/e2')
  })

  it('invites a new organizer to create the first event', async () => {
    signInAs('Owner')
    stubApi([{ path: '/events', response: () => jsonResponse([]) }])
    renderRoute('/app')

    expect(
      await screen.findByText('Selamat datang. Mulai dengan membuat acara pertama Anda.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Belum ada acara' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Kelola tamu' })).not.toBeInTheDocument()
  })

  it('shows the statistics page with RSVP answers and check-ins per hour', async () => {
    signInAs('Admin')
    stubApi([
      { path: '/events', response: () => jsonResponse([event('e1', 'Resepsi Rina & Budi', 'Active')]) },
      {
        path: '/events/e1',
        response: () =>
          jsonResponse({
            ...event('e1', 'Resepsi Rina & Budi', 'Active'),
            description: null,
            sessions: [],
            staffCount: 3,
            package: null,
            activatedAt: null,
            createdAt: '',
            updatedAt: '',
            version: 1,
          }),
      },
      { path: '/events/e1/stats', response: () => jsonResponse(stats) },
    ])
    renderRoute('/app/events/e1/stats')

    expect(await screen.findByRole('heading', { level: 1, name: 'Statistik' })).toBeInTheDocument()
    const answers = screen
      .getByRole('heading', { name: 'Jawaban RSVP' })
      .closest('div.rounded-2xl') as HTMLElement
    expect(within(answers).getByText('Hadir').closest('div')).toHaveTextContent('80')
    // The chart's data is also a table for screen readers.
    const table = screen.getByRole('table', { name: 'Check-in per jam' })
    expect(within(table).getAllByRole('row')).toHaveLength(3)
    expect(screen.getByText('Rp 3.500.000', { exact: false })).toBeInTheDocument()
  })
})

describe('guest list on a phone', () => {
  it('shows cards instead of the table', async () => {
    changeLocale('id')
    signInAs('Owner')
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    )
    stubApi([
      { path: '/events', response: () => jsonResponse([]) },
      {
        path: '/events/e1',
        response: () =>
          jsonResponse({
            ...event('e1', 'Resepsi', 'Active'),
            description: null,
            sessions: [],
            staffCount: 0,
            package: null,
            activatedAt: null,
            createdAt: '',
            updatedAt: '',
            version: 1,
          }),
      },
      {
        path: '/events/e1/guests',
        response: () =>
          jsonResponse({
            guests: [
              {
                id: 'g1',
                eventId: 'e1',
                name: 'Keluarga Wijaya',
                phone: '081234567890',
                email: null,
                guestType: 'Group',
                numberOfPeople: 4,
                sessionIds: [],
                invitation: { id: 'i1', code: 'abc', status: 'Active', url: 'https://x.test/i/abc' },
                rsvp: 'Attending',
                checkedInAt: null,
                createdAt: '',
              },
            ],
            total: 1,
            totalPeople: 4,
            limit: 500,
          }),
      },
    ])
    renderRoute('/app/events/e1/guests')

    const name = await screen.findByRole('link', { name: 'Keluarga Wijaya' })
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    const card = name.closest('div.relative') as HTMLElement
    expect(within(card).getByText(/4 orang/)).toBeInTheDocument()
    expect(within(card).getByText('Hadir')).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'Kirim via WhatsApp' })).toBeInTheDocument()
  })
})
