import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { changeLocale } from '@/i18n'
import { renderRoute } from '@/test/renderRoute'

describe('routes', () => {
  beforeEach(() => {
    changeLocale('id')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the API as connected when /system/info answers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ name: 'EventLy', version: '0.1.0', environment: 'Development' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )

    renderRoute('/')

    expect(screen.getByRole('heading', { name: 'Selamat datang di EventLy' })).toBeInTheDocument()
    expect(await screen.findByText(/Terhubung · v0.1.0/)).toBeInTheDocument()
  })

  it('shows the API as disconnected when the server is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    renderRoute('/')

    expect(await screen.findByText(/Tidak terhubung/)).toBeInTheDocument()
  })

  it.each([
    ['/app', 'Dashboard'],
    ['/staff', 'Scan QR'],
    ['/i/abc123', 'Undangan'],
    ['/platform', 'Paket & Owner'],
  ])('renders the %s area', (path, title) => {
    renderRoute(path)

    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
  })

  it('shows a 404 page for unknown routes', () => {
    renderRoute('/does-not-exist')

    expect(screen.getByRole('heading', { name: 'Halaman tidak ditemukan' })).toBeInTheDocument()
  })
})
