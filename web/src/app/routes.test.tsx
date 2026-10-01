import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { changeLocale } from '@/i18n'
import { renderRoute } from '@/test/renderRoute'
import { jsonResponse, signInAs, stubApi } from '@/test/session'

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

    expect(screen.getByRole('heading', { level: 1, name: /Buat acara lebih berkesan/ })).toBeInTheDocument()
    expect(await screen.findByText(/Terhubung · v0.1.0/)).toBeInTheDocument()
  })

  it('shows the API as disconnected when the server is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    renderRoute('/')

    expect(await screen.findByText(/Tidak terhubung/)).toBeInTheDocument()
  })

  it.each([
    ['/app', 'Owner', /^Halo, Rina/],
    ['/app', 'Admin', /^Halo, Rina/],
    ['/staff', 'Staff', 'Acara saya'],
    ['/staff', 'Owner', 'Acara saya'],
    ['/platform', 'Root', 'Owner'],
  ] as const)('lets %s through for a signed-in %s', async (path, role, title) => {
    signInAs(role)

    renderRoute(path)

    // Lazy-loaded pages appear asynchronously.
    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument()
  })

  it('sends an anonymous visitor of a protected page to the login page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ googleClientId: null, devSignInEnabled: false })),
    )

    renderRoute('/app')

    expect(await screen.findByRole('heading', { name: 'Masuk ke EventLy' })).toBeInTheDocument()
  })

  it.each([
    ['/platform', 'Owner', /^Halo, Rina/],
    ['/app', 'Staff', 'Acara saya'],
    ['/app', 'Root', 'Owner'],
  ] as const)('redirects %s to the home of a %s', async (path, role, expectedTitle) => {
    signInAs(role)

    renderRoute(path)

    expect(await screen.findByRole('heading', { name: expectedTitle })).toBeInTheDocument()
  })

  it('keeps guest invitation pages public', async () => {
    stubApi([]) // unknown code: the API answers 404
    renderRoute('/i/abc123')

    expect(await screen.findByRole('heading', { name: 'Undangan tidak ditemukan' })).toBeInTheDocument()
  })

  it('shows a 404 page for unknown routes', () => {
    renderRoute('/does-not-exist')

    expect(screen.getByRole('heading', { name: 'Halaman tidak ditemukan' })).toBeInTheDocument()
  })
})
