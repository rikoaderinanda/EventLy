import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Package } from '@/features/payments/api'
import { changeLocale } from '@/i18n'
import { renderRoute } from '@/test/renderRoute'
import { jsonResponse, signInAs, stubApi } from '@/test/session'
import type { PlatformOwnerDetail } from './api'

const features = {
  maxGuests: 150,
  maxPhotos: 300,
  maxStaff: 2,
  maxAdmins: 1,
  galleryRetentionDays: 30,
  zipDownload: false,
  excelExport: false,
  guestUploadEnabled: false,
  maxGuestPhotosPerInvitation: 0,
  wishesEnabled: true,
  digitalGiftEnabled: true,
  backgroundMusicEnabled: true,
  countdownEnabled: true,
}

const basic: Package = {
  id: 'basic',
  code: 'BASIC',
  name: 'Basic',
  price: 150000,
  currency: 'IDR',
  features,
  isActive: true,
}

const owner: PlatformOwnerDetail = {
  owner: {
    id: 'o1',
    name: 'Rina',
    email: 'rina@x.test',
    status: 'Active',
    organization: { id: 'org1', name: 'Santoso WO', status: 'Active' },
    purchases: { events: 1, paidEvents: 0, pendingPayments: 0 },
    createdAt: '',
    lastSignInAt: null,
  },
  events: [
    {
      id: 'e1',
      name: 'Pernikahan Rina & Budi',
      date: '2026-12-12T04:00:00Z',
      timeZone: 'Asia/Jakarta',
      status: 'Draft',
      packageName: null,
    },
  ],
  payments: [],
}

describe('Root platform pages', () => {
  beforeEach(() => {
    changeLocale('id')
    signInAs('Root')
  })

  it('activates an event paid by bank transfer', async () => {
    const fetchMock = stubApi([
      { path: '/platform/owners/o1', response: () => jsonResponse(owner) },
      { path: '/platform/packages', response: () => jsonResponse([basic]) },
      { method: 'POST', path: '/platform/events/e1/activate', response: () => jsonResponse({}) },
    ])
    renderRoute('/platform/owners/o1')

    const row = (await screen.findByText('Pernikahan Rina & Budi')).closest('li')!
    await userEvent.click(within(row).getByRole('button', { name: 'Aktifkan manual' }))
    await within(row).findByRole('option', { name: /Basic/ })
    await userEvent.selectOptions(within(row).getByLabelText('Paket'), 'basic')
    expect(within(row).getByLabelText('Jumlah diterima (Rp)')).toHaveValue(150000)
    await userEvent.type(within(row).getByLabelText('Catatan pembayaran'), 'BCA ref 8812')
    await userEvent.click(within(row).getByRole('button', { name: 'Aktifkan acara' }))

    const post = fetchMock.mock.calls.find((c) => c[1]?.method === 'POST')!
    expect(JSON.parse(String(post[1]!.body))).toEqual({
      packageId: 'basic',
      amount: 150000,
      note: 'BCA ref 8812',
    })
  })

  it('creates a package with its limits', async () => {
    const fetchMock = stubApi([
      { path: '/platform/packages', response: () => jsonResponse([basic]) },
      { method: 'POST', path: '/platform/packages', response: () => jsonResponse(basic, 201) },
    ])
    renderRoute('/platform/packages')

    await userEvent.click(await screen.findByRole('button', { name: 'Paket baru' }))
    const form = screen.getByRole('form', { name: 'Paket baru' })
    await userEvent.type(within(form).getByLabelText('Kode'), 'GOLD')
    await userEvent.type(within(form).getByLabelText('Nama paket'), 'Gold')
    await userEvent.type(within(form).getByLabelText('Harga (Rp)'), '500000')
    await userEvent.clear(within(form).getByLabelText('Maks. tamu'))
    await userEvent.type(within(form).getByLabelText('Maks. tamu'), '1000')
    await userEvent.click(within(form).getByLabelText('Unduh ZIP'))
    await userEvent.click(within(form).getByRole('button', { name: 'Simpan' }))

    const post = fetchMock.mock.calls.find((c) => c[1]?.method === 'POST')!
    expect(JSON.parse(String(post[1]!.body))).toMatchObject({
      code: 'GOLD',
      name: 'Gold',
      price: 500000,
      currency: 'IDR',
      isActive: true,
      features: { maxGuests: 1000, zipDownload: true },
    })
  })

  it('switches between owners and packages', async () => {
    stubApi([
      { path: '/platform/owners', response: () => jsonResponse([]) },
      { path: '/platform/packages', response: () => jsonResponse([basic]) },
    ])
    renderRoute('/platform')

    await userEvent.click(await screen.findByRole('link', { name: 'Paket' }))

    // The packages page is lazy-loaded; give it more than the default 1 s on a busy machine.
    expect(await screen.findByRole('heading', { name: 'Paket' }, { timeout: 5000 })).toBeInTheDocument()
    expect(await screen.findByText('Basic')).toBeInTheDocument()
  })
})
