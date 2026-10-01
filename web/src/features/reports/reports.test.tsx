import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fileNameOf } from '@/api/client'
import type { EventDetail } from '@/features/events/api'
import { changeLocale } from '@/i18n'
import { renderRoute } from '@/test/renderRoute'
import { signInAs, stubApi, jsonResponse } from '@/test/session'

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
  theme: 'Elegant',
}

const withExcel = (excelExport: boolean): EventDetail => ({
  ...event,
  package: {
    id: 'p',
    code: excelExport ? 'PREMIUM' : 'BASIC',
    name: excelExport ? 'Premium' : 'Basic',
    features: { excelExport } as EventDetail['package'] extends infer P
      ? P extends { features: infer F }
        ? F
        : never
      : never,
  },
})

const csv = () =>
  new Response('﻿Nama;Jenis\r\n', {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition':
        "attachment; filename=x.csv; filename*=UTF-8''resepsi-rina-budi-tamu-2026-10-01.csv",
    },
  })

describe('reports', () => {
  beforeEach(() => {
    changeLocale('id')
    signInAs('Admin')
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }),
    )
  })

  it('downloads a CSV under the server file name and locks Excel on a CSV-only package', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const fetchMock = stubApi([
      { path: '/events/e1', response: () => jsonResponse(withExcel(false)) },
      { path: '/events/e1/reports/guests?format=csv', response: csv },
    ])
    renderRoute('/app/events/e1/reports')

    expect(await screen.findByText('Paket ini hanya CSV')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Unduh Tamu sebagai Excel' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Unduh semua (Excel)' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Unduh Tamu sebagai CSV' }))

    expect(
      fetchMock.mock.calls.some((c) => String(c[0]).endsWith('/events/e1/reports/guests?format=csv')),
    ).toBe(true)
    const link = click.mock.contexts.at(-1) as HTMLAnchorElement
    expect(link.download).toBe('resepsi-rina-budi-tamu-2026-10-01.csv')
  })

  it('offers Excel and the all-in-one workbook with excel export', async () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const fetchMock = stubApi([
      { path: '/events/e1', response: () => jsonResponse(withExcel(true)) },
      { path: '/events/e1/reports', response: () => new Response(new Blob(['xlsx']), { status: 200 }) },
    ])
    renderRoute('/app/events/e1/reports')

    // The all-in-one button appears once the package is known.
    const all = await screen.findByRole('button', { name: 'Unduh semua (Excel)' })
    expect(screen.getByRole('button', { name: 'Unduh Check-in sebagai Excel' })).toBeEnabled()
    await userEvent.click(all)

    expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith('/events/e1/reports'))).toBe(true)
  })

  it('reads the file name from Content-Disposition', () => {
    expect(fileNameOf("attachment; filename=a.csv; filename*=UTF-8''r%C3%A9sum%C3%A9.csv")).toBe('résumé.csv')
    expect(fileNameOf('attachment; filename="tamu.csv"')).toBe('tamu.csv')
    expect(fileNameOf(null)).toBeNull()
  })
})
