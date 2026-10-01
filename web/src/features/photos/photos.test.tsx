import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventDetail } from '@/features/events/api'
import { changeLocale } from '@/i18n'
import { renderRoute } from '@/test/renderRoute'
import { jsonResponse, resetSession, signInAs, stubApi } from '@/test/session'
import type { Gallery } from './api'

// jsdom has no canvas: the shrinking step returns the file as it is.
vi.mock('@/shared/lib/image', async (original) => ({
  ...(await original<typeof import('@/shared/lib/image')>()),
  compressPhoto: vi.fn((file: Blob) => Promise.resolve(file)),
}))

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

const photo = (id: string, guestName: string, source: 'Staff' | 'Guest' = 'Staff') => ({
  id,
  invitationId: 'i-' + guestName,
  guestName,
  source,
  thumbnailUrl: `https://storage.test/${id}_thumb.jpg`,
  url: `https://storage.test/${id}.jpg`,
  width: 2048,
  height: 1536,
  createdAt: '2026-12-12T05:00:00Z',
})

const gallery: Gallery = {
  photos: [photo('p1', 'Keluarga Wijaya'), photo('p2', 'Keluarga Wijaya', 'Guest'), photo('p3', 'Sari')],
  total: 3,
  limit: 1500,
  storageBytes: 3 * 1024 * 1024,
  zipAllowed: true,
  guestCameraInPackage: true,
  guestCameraEnabled: true,
}

describe('photos', () => {
  beforeEach(() => {
    changeLocale('id')
  })

  it('shows the gallery grouped by guest and deletes a photo', async () => {
    signInAs('Admin')
    const fetchMock = stubApi([
      { path: '/events/e1', response: () => jsonResponse(event) },
      { path: '/events/e1/gallery', response: () => jsonResponse(gallery) },
      { method: 'DELETE', path: '/photos/p3', response: () => jsonResponse(null, 204) },
      { method: 'PUT', path: '/events/e1/guest-camera', response: () => jsonResponse(null, 204) },
    ])
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    )
    renderRoute('/app/events/e1/gallery')

    expect(await screen.findByText('3 dari 1500 foto · 3 MB')).toBeInTheDocument()
    const wijaya = screen.getByRole('heading', { name: /Keluarga Wijaya/ }).parentElement!
    expect(within(wijaya).getAllByRole('img')).toHaveLength(2)
    expect(within(wijaya).getByText('tamu')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Unduh semua (ZIP)' })).toBeInTheDocument()

    const sari = screen.getByRole('heading', { name: /Sari/ }).parentElement!
    await userEvent.click(within(sari).getByRole('button', { name: 'Hapus' }))
    await userEvent.click(screen.getByRole('checkbox', { name: /Tamu boleh memotret/ }))

    expect(
      fetchMock.mock.calls.some((c) => String(c[0]).endsWith('/photos/p3') && c[1]?.method === 'DELETE'),
    ).toBe(true)
    const put = fetchMock.mock.calls.find((c) => c[1]?.method === 'PUT')!
    expect(JSON.parse(String(put[1]!.body))).toEqual({ enabled: false })
  })

  it('uploads the cover photo and music of the invitation', async () => {
    signInAs('Owner')
    const fetchMock = stubApi([
      { path: '/events/e1', response: () => jsonResponse(event) },
      {
        path: '/events/e1/media',
        response: () => jsonResponse({ coverUrl: null, qrisUrl: null, musicUrl: null }),
      },
      {
        method: 'PUT',
        path: '/events/e1/media/music',
        response: () =>
          jsonResponse({ coverUrl: null, qrisUrl: null, musicUrl: 'https://storage.test/m.mp3' }),
      },
    ])
    renderRoute('/app/events/e1/media')

    const music = new File(['ID3'], 'lagu.mp3', { type: 'audio/mpeg' })
    await userEvent.upload(await screen.findByLabelText('Musik latar'), music)

    const put = fetchMock.mock.calls.find((c) => c[1]?.method === 'PUT')!
    expect(put[1]!.body).toBeInstanceOf(FormData)
    expect(await screen.findByRole('button', { name: 'Hapus' })).toBeInTheDocument()
  })

  it('lets staff add photos after a check-in', async () => {
    signInAs('Staff')
    const fetchMock = stubApi([
      { path: '/events/e1', response: () => jsonResponse(event) },
      {
        path: '/events/e1/check-ins/summary',
        response: () =>
          jsonResponse({ invitations: 1, people: 1, checkedInInvitations: 0, checkedInPeople: 0 }),
      },
      {
        path: '/events/e1/check-ins/lookup?code=abcdefghijklmnopqrstuv',
        response: () =>
          jsonResponse({
            invitationId: 'i1',
            guestName: 'Sari',
            type: 'Individual',
            numberOfPeople: 1,
            rsvp: 'Attending',
            alreadyCheckedIn: true,
            checkedInAt: '2026-12-12T05:00:00Z',
            checkedInBy: 'Budi',
            warnings: [],
          }),
      },
      {
        method: 'POST',
        path: '/invitations/i1/photos',
        response: () => jsonResponse([photo('p1', 'Sari')], 201),
      },
    ])
    renderRoute('/staff/events/e1')

    await userEvent.click(await screen.findByRole('tab', { name: 'Cari tamu' }))
    await userEvent.type(screen.getByLabelText('Ketik kode undangan'), 'abcdefghijklmnopqrstuv')
    await userEvent.click(screen.getByRole('button', { name: 'Cari' }))
    expect(await screen.findByRole('button', { name: 'Ambil foto' })).toBeInTheDocument()
    await userEvent.upload(
      screen.getByLabelText('atau pilih file foto'),
      new File(['jpeg'], 'a.jpg', { type: 'image/jpeg' }),
    )

    expect(await screen.findByText('1 foto terunggah.')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith('/invitations/i1/photos'))).toBe(true)
  })

  it('shows the guest their photos after check-in, with the camera button', async () => {
    resetSession()
    stubApi([
      {
        path: '/public/invitations/abcdefghijklmnopqrstuv',
        response: () =>
          jsonResponse({
            guestName: 'Sari',
            type: 'Individual',
            numberOfPeople: 1,
            event: { ...event, coverUrl: 'https://storage.test/cover.jpg', sessions: [] },
            rsvp: { status: 'Attending', respondedAt: null, isOpen: false, closesAt: '' },
            features: {
              countdown: false,
              wishes: false,
              wishesOpen: false,
              digitalGift: false,
              backgroundMusic: false,
            },
            myWish: null,
            checkedIn: true,
          }),
      },
      {
        path: '/public/invitations/abcdefghijklmnopqrstuv/gallery',
        response: () =>
          jsonResponse({
            photos: [
              {
                id: 'p1',
                thumbnailUrl: 'https://storage.test/t1',
                url: 'https://storage.test/1',
                isMine: true,
                createdAt: '',
              },
              {
                id: 'p2',
                thumbnailUrl: 'https://storage.test/t2',
                url: 'https://storage.test/2',
                isMine: false,
                createdAt: '',
              },
            ],
            camera: { available: true, taken: 1, limit: 5, closesAt: '2026-12-12T17:00:00Z' },
          }),
      },
    ])
    renderRoute('/i/abcdefghijklmnopqrstuv')

    await userEvent.click(await screen.findByRole('button', { name: 'Buka Undangan' }))

    expect(await screen.findByRole('heading', { name: 'Foto Anda' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Ambil foto' })).toBeInTheDocument()
    expect(screen.getByText(/Sisa 4 dari 5 foto/)).toBeInTheDocument()
    // Only the guest's own shot can be deleted; both can be downloaded.
    expect(screen.getAllByRole('button', { name: 'Hapus' })).toHaveLength(1)
    expect(screen.getAllByRole('link', { name: 'Unduh' })).toHaveLength(2)
  })
})
