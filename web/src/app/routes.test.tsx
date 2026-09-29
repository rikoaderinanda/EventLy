import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { changeLocale } from '@/i18n'
import { renderRoute } from '@/test/renderRoute'
import { jsonResponse, signInAs } from '@/test/session'

describe('routes', () => {
  beforeEach(() => {
    changeLocale('id')
  })

  it('shows the API as connected when /system/info answers', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(jsonResponse({ name: 'EventLy', version: '0.1.0', environment: 'Development' })),
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
    ['/app', 'Owner', 'Dashboard'],
    ['/app', 'Admin', 'Dashboard'],
    ['/staff', 'Staff', 'Scan QR'],
    ['/staff', 'Owner', 'Scan QR'],
    ['/platform', 'Root', 'Paket & Owner'],
  ] as const)('lets %s through for a signed-in %s', (path, role, title) => {
    signInAs(role)

    renderRoute(path)

    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
  })

  it('sends an anonymous visitor of a protected page to the login page', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ googleClientId: null, devSignInEnabled: false })),
    )

    renderRoute('/app')

    expect(screen.getByRole('heading', { name: 'Masuk ke EventLy' })).toBeInTheDocument()
  })

  it.each([
    ['/platform', 'Owner', 'Dashboard'],
    ['/app', 'Staff', 'Scan QR'],
    ['/app', 'Root', 'Paket & Owner'],
  ] as const)('redirects %s to the home of a %s', (path, role, expectedTitle) => {
    signInAs(role)

    renderRoute(path)

    expect(screen.getByRole('heading', { name: expectedTitle })).toBeInTheDocument()
  })

  it('keeps guest invitation pages public', () => {
    renderRoute('/i/abc123')

    expect(screen.getByRole('heading', { name: 'Undangan' })).toBeInTheDocument()
  })

  it('shows a 404 page for unknown routes', () => {
    renderRoute('/does-not-exist')

    expect(screen.getByRole('heading', { name: 'Halaman tidak ditemukan' })).toBeInTheDocument()
  })
})
