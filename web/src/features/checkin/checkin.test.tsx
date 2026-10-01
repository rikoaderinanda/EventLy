import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { EventDetail } from '@/features/events/api'
import { changeLocale } from '@/i18n'
import { renderRoute } from '@/test/renderRoute'
import { jsonResponse, signInAs, stubApi } from '@/test/session'
import type { CheckInResult } from './api'

const code = 'abcdefghijklmnopqrstuv'

const event: EventDetail = {
  id: 'e1',
  name: 'Resepsi Rina & Budi',
  category: 'Wedding',
  description: null,
  timeZone: 'Asia/Jakarta',
  date: '2026-12-12T04:00:00Z',
  venue: 'Gedung',
  status: 'Active',
  sessions: [],
  staffCount: 1,
  package: null,
  activatedAt: null,
  createdAt: '',
  updatedAt: '',
  version: 1,
}

const found: CheckInResult = {
  invitationId: 'i1',
  guestName: 'Keluarga Wijaya',
  type: 'Group',
  numberOfPeople: 3,
  rsvp: 'NotAttending',
  alreadyCheckedIn: false,
  checkedInAt: null,
  checkedInBy: null,
  warnings: ['rsvp_not_attending'],
}

const summary = { invitations: 10, people: 25, checkedInInvitations: 2, checkedInPeople: 5 }

describe('check-in', () => {
  beforeEach(() => {
    changeLocale('id')
    signInAs('Staff')
  })

  it('looks up a typed code, shows the warning and checks the guest in', async () => {
    const fetchMock = stubApi([
      { path: '/events/e1', response: () => jsonResponse(event) },
      { path: '/events/e1/check-ins/summary', response: () => jsonResponse(summary) },
      { path: `/events/e1/check-ins/lookup?code=${code}`, response: () => jsonResponse(found) },
      {
        method: 'POST',
        path: '/events/e1/check-ins',
        response: () =>
          jsonResponse(
            { ...found, rsvp: 'Attending', checkedInAt: '2026-12-12T05:00:00Z', checkedInBy: 'Sari' },
            201,
          ),
      },
    ])
    renderRoute('/staff/events/e1')

    expect(await screen.findByText('5 dari 25 orang hadir · 2/10 undangan')).toBeInTheDocument()
    // No camera in the test browser: the scanner says so and points to manual entry.
    expect(await screen.findByText(/Kamera tidak tersedia/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Cari tamu' }))
    await userEvent.type(screen.getByLabelText('Ketik kode undangan'), code)
    await userEvent.click(screen.getByRole('button', { name: 'Cari' }))

    expect(await screen.findByText('Keluarga Wijaya')).toBeInTheDocument()
    expect(screen.getByText(/Tamu sebelumnya menjawab tidak hadir/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Check-in' }))

    expect(await screen.findByText('✓ Check-in berhasil')).toBeInTheDocument()
    const post = fetchMock.mock.calls.find((c) => c[1]?.method === 'POST')!
    expect(JSON.parse(String(post[1]!.body))).toEqual({ code, invitationId: null })
    await userEvent.click(screen.getByRole('button', { name: 'Tamu berikutnya' }))
    expect(screen.getByLabelText('Ketik kode undangan')).toBeVisible()
  })

  it('tells staff when the guest already checked in', async () => {
    stubApi([
      { path: '/events/e1', response: () => jsonResponse(event) },
      { path: '/events/e1/check-ins/summary', response: () => jsonResponse(summary) },
      {
        path: `/events/e1/check-ins/lookup?code=${code}`,
        response: () =>
          jsonResponse({
            ...found,
            warnings: [],
            alreadyCheckedIn: true,
            checkedInAt: '2026-12-12T04:05:00Z',
            checkedInBy: 'Sari',
          }),
      },
    ])
    renderRoute('/staff/events/e1')

    await userEvent.click(await screen.findByRole('tab', { name: 'Cari tamu' }))
    await userEvent.type(screen.getByLabelText('Ketik kode undangan'), code)
    await userEvent.click(screen.getByRole('button', { name: 'Cari' }))

    expect(await screen.findByText(/Sudah check-in pukul .* oleh Sari/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Check-in' })).not.toBeInTheDocument()
  })

  it('shows an invalid invitation in red', async () => {
    stubApi([
      { path: '/events/e1', response: () => jsonResponse(event) },
      { path: '/events/e1/check-ins/summary', response: () => jsonResponse(summary) },
      {
        path: '/events/e1/check-ins/lookup?code=salah',
        response: () =>
          jsonResponse(
            { status: 404, code: 'checkin.invitation_not_found' },
            404,
            'application/problem+json',
          ),
      },
    ])
    renderRoute('/staff/events/e1')

    await userEvent.click(await screen.findByRole('tab', { name: 'Cari tamu' }))
    await userEvent.type(screen.getByLabelText('Ketik kode undangan'), 'salah')
    await userEvent.click(screen.getByRole('button', { name: 'Cari' }))

    expect(await screen.findByText('Undangan tidak valid')).toBeInTheDocument()
    expect(screen.getByText(/Tamu tanpa undangan tidak bisa check-in/)).toBeInTheDocument()
  })

  it('checks in a guest found by name', async () => {
    const fetchMock = stubApi([
      { path: '/events/e1', response: () => jsonResponse(event) },
      { path: '/events/e1/check-ins/summary', response: () => jsonResponse(summary) },
      {
        path: '/events/e1/check-ins/search?q=wija',
        response: () =>
          jsonResponse([
            {
              invitationId: 'i1',
              guestName: 'Keluarga Wijaya',
              type: 'Group',
              numberOfPeople: 3,
              checkedIn: false,
            },
          ]),
      },
      {
        method: 'POST',
        path: '/events/e1/check-ins',
        response: () =>
          jsonResponse(
            { ...found, warnings: [], rsvp: 'Attending', checkedInAt: '2026-12-12T05:00:00Z' },
            201,
          ),
      },
    ])
    renderRoute('/staff/events/e1')

    await userEvent.click(await screen.findByRole('tab', { name: 'Cari tamu' }))
    await userEvent.type(screen.getByLabelText('Cari nama tamu'), 'wija')
    await userEvent.click(await screen.findByRole('button', { name: /Keluarga Wijaya/ }))

    expect(await screen.findByText('✓ Check-in berhasil')).toBeInTheDocument()
    const post = fetchMock.mock.calls.find((c) => c[1]?.method === 'POST')!
    expect(JSON.parse(String(post[1]!.body))).toEqual({ code: null, invitationId: 'i1' })
  })

  it('opens the scanner from the staff event list', async () => {
    stubApi([
      {
        path: '/events',
        response: () =>
          jsonResponse([
            {
              id: 'e1',
              name: 'Resepsi',
              category: 'Wedding',
              timeZone: 'Asia/Jakarta',
              date: event.date,
              venue: 'Gedung',
              status: 'Active',
            },
          ]),
      },
    ])
    renderRoute('/staff')

    expect(await screen.findByRole('link', { name: 'Buka scanner check-in' })).toHaveAttribute(
      'href',
      '/staff/events/e1',
    )
  })

  it('shows the organizer who checked in', async () => {
    signInAs('Admin')
    stubApi([
      { path: '/events/e1', response: () => jsonResponse(event) },
      { path: '/events/e1/check-ins/summary', response: () => jsonResponse(summary) },
      {
        path: '/events/e1/check-ins',
        response: () =>
          jsonResponse([
            {
              id: 'c1',
              invitationId: 'i1',
              guestName: 'Keluarga Wijaya',
              numberOfPeople: 3,
              checkedInAt: '2026-12-12T05:00:00Z',
              staffId: 's1',
              staffName: 'Sari',
              method: 'Scan',
            },
          ]),
      },
    ])
    renderRoute('/app/events/e1/check-ins')

    expect(await screen.findByText('Keluarga Wijaya')).toBeInTheDocument()
    expect(screen.getByText(/Sari · scan QR/)).toBeInTheDocument()
  })
})
