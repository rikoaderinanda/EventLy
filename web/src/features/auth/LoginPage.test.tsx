import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { changeLocale } from '@/i18n'
import { renderRoute } from '@/test/renderRoute'
import { fakeAuthResponse, jsonResponse, signInAs } from '@/test/session'
import { useSession } from './session-store'

function stubApi(signInResponse: Response) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    if (url.endsWith('/auth/config')) {
      return Promise.resolve(jsonResponse({ googleClientId: null, devSignInEnabled: true }))
    }
    if (url.endsWith('/auth/dev-sign-in')) {
      return Promise.resolve(signInResponse)
    }
    return Promise.resolve(jsonResponse({}, 404))
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('LoginPage', () => {
  beforeEach(() => {
    changeLocale('id')
  })

  it('signs in with the development form and goes to the role home', async () => {
    stubApi(jsonResponse(fakeAuthResponse('Staff')))
    renderRoute('/login')

    await userEvent.type(await screen.findByLabelText('Email'), 'budi@example.test')
    await userEvent.click(screen.getByRole('button', { name: 'Masuk (test)' }))

    expect(await screen.findByRole('heading', { name: 'Acara saya' })).toBeInTheDocument()
    expect(useSession.getState().accessToken).toBe('access-token-1')
  })

  it('returns to the page the user originally asked for', async () => {
    stubApi(jsonResponse(fakeAuthResponse('Owner')))
    renderRoute('/login?next=%2Fstaff')

    await userEvent.type(await screen.findByLabelText('Email'), 'rina@example.test')
    await userEvent.click(screen.getByRole('button', { name: 'Masuk (test)' }))

    expect(await screen.findByRole('heading', { name: 'Acara saya' })).toBeInTheDocument()
  })

  it('ignores an external next= target (no open redirect)', async () => {
    stubApi(jsonResponse(fakeAuthResponse('Owner')))
    renderRoute('/login?next=%2F%2Fevil.example')

    await userEvent.type(await screen.findByLabelText('Email'), 'rina@example.test')
    await userEvent.click(screen.getByRole('button', { name: 'Masuk (test)' }))

    expect(await screen.findByRole('heading', { name: 'Acara' })).toBeInTheDocument()
  })

  it('shows a readable message when the account is disabled', async () => {
    stubApi(jsonResponse({ status: 403, code: 'auth.account_disabled' }, 403, 'application/problem+json'))
    renderRoute('/login')

    await userEvent.type(await screen.findByLabelText('Email'), 'off@example.test')
    await userEvent.click(screen.getByRole('button', { name: 'Masuk (test)' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Akun ini dinonaktifkan')
    expect(useSession.getState().status).toBe('anonymous')
  })

  it('sends an already signed-in user straight to their home', async () => {
    stubApi(jsonResponse({}))
    signInAs('Root')

    renderRoute('/login')

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Owner' })).toBeInTheDocument())
  })
})
