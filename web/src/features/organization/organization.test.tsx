import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { useSession } from '@/features/auth/session-store'
import { changeLocale } from '@/i18n'
import { renderRoute } from '@/test/renderRoute'
import { fakeUser, jsonResponse, signInAs, stubApi } from '@/test/session'

const config = { googleClientId: null, devSignInEnabled: false, termsVersion: '2026-09-29' }
const organization = {
  id: '0192f000-0000-7000-8000-00000000a001',
  name: 'Santoso WO',
  contactEmail: null,
  contactPhone: null,
  status: 'Active',
  createdAt: '2026-09-29T08:00:00Z',
}

describe('onboarding', () => {
  beforeEach(() => {
    changeLocale('id')
  })

  it('sends an owner without organization to onboarding', async () => {
    stubApi([{ path: '/auth/config', response: () => jsonResponse(config) }])
    signInAs('Owner', { organizationId: null })

    renderRoute('/app')

    expect(await screen.findByRole('heading', { name: 'Buat organisasi Anda' })).toBeInTheDocument()
  })

  it('requires accepting the terms, then creates the organization and opens the dashboard', async () => {
    const fetchMock = stubApi([
      { path: '/auth/config', response: () => jsonResponse(config) },
      {
        method: 'POST',
        path: '/organization',
        response: () =>
          jsonResponse(
            {
              organization,
              accessToken: 'access-token-with-org',
              expiresIn: 900,
              user: fakeUser('Owner'),
            },
            201,
          ),
      },
    ])
    signInAs('Owner', { organizationId: null })
    renderRoute('/onboarding')

    await userEvent.type(await screen.findByLabelText('Nama organisasi'), 'Santoso WO')
    const submit = screen.getByRole('button', { name: 'Buat organisasi' })
    expect(submit).toBeDisabled()

    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(submit)

    expect(await screen.findByRole('heading', { name: /^Halo, Rina/ })).toBeInTheDocument()
    expect(useSession.getState().accessToken).toBe('access-token-with-org')
    const body = JSON.parse(String(fetchMock.mock.calls.find((c) => c[1]?.method === 'POST')![1]!.body))
    expect(body).toMatchObject({ name: 'Santoso WO', acceptTerms: true, termsVersion: '2026-09-29' })
  })

  it('shows the terms page from the onboarding link', async () => {
    renderRoute('/legal/terms')

    expect(await screen.findByRole('heading', { level: 1, name: /Syarat & Ketentuan/ })).toBeInTheDocument()
  })
})

describe('organizer navigation', () => {
  beforeEach(() => {
    changeLocale('id')
  })

  it('shows the Users tab to the owner only', async () => {
    signInAs('Owner')
    const { unmount } = renderRoute('/app')
    expect(await screen.findByRole('link', { name: 'Pengguna' })).toBeInTheDocument()
    unmount()

    signInAs('Admin')
    renderRoute('/app')
    expect(await screen.findByRole('link', { name: 'Organisasi' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Pengguna' })).not.toBeInTheDocument()
  })

  it('keeps an admin out of the users page', () => {
    signInAs('Admin')

    renderRoute('/app/users')

    expect(screen.queryByRole('heading', { name: 'Pengguna' })).not.toBeInTheDocument()
  })

  it('lets an admin read but not edit the organization profile', async () => {
    stubApi([{ path: '/organization', response: () => jsonResponse(organization) }])
    signInAs('Admin')

    renderRoute('/app/organization')

    expect(await screen.findByDisplayValue('Santoso WO')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Simpan' })).not.toBeInTheDocument()
  })
})
