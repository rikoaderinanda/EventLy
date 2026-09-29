import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { changeLocale } from '@/i18n'
import { renderRoute } from '@/test/renderRoute'
import { jsonResponse, signInAs, stubApi } from '@/test/session'

const members = [
  {
    id: 'u1',
    name: 'Rina',
    email: 'rina@x.test',
    avatarUrl: null,
    role: 'Owner',
    status: 'Active',
    lastSignInAt: null,
    createdAt: '',
  },
  {
    id: 'u2',
    name: 'Budi',
    email: 'budi@x.test',
    avatarUrl: null,
    role: 'Staff',
    status: 'Invited',
    lastSignInAt: null,
    createdAt: '',
  },
]

describe('UsersPage', () => {
  beforeEach(() => {
    changeLocale('id')
    signInAs('Owner')
  })

  it('lists members with their status', async () => {
    stubApi([{ path: '/users', response: () => jsonResponse(members) }])

    renderRoute('/app/users')

    const budi = (await screen.findByText('Budi')).closest('li')!
    expect(within(budi).getByText('Diundang')).toBeInTheDocument()
    expect(within(budi).getByRole('button', { name: 'Batalkan undangan' })).toBeInTheDocument()
    // The Owner row has no controls.
    expect(within(screen.getByText('Rina').closest('li')!).queryByRole('button')).not.toBeInTheDocument()
  })

  it('invites a staff member by Google email', async () => {
    const fetchMock = stubApi([
      { path: '/users', response: () => jsonResponse(members) },
      { method: 'POST', path: '/users', response: () => jsonResponse(members[1], 201) },
    ])
    renderRoute('/app/users')

    await userEvent.type(await screen.findByLabelText('Nama'), 'Sari')
    await userEvent.type(screen.getByLabelText('Email Google'), 'sari@gmail.test')
    await userEvent.click(screen.getByRole('button', { name: 'Undang' }))

    const post = fetchMock.mock.calls.find((c) => c[1]?.method === 'POST')!
    expect(JSON.parse(String(post[1]!.body))).toEqual({
      name: 'Sari',
      email: 'sari@gmail.test',
      role: 'Staff',
    })
  })

  it('explains when the email is already registered', async () => {
    stubApi([
      { path: '/users', response: () => jsonResponse(members) },
      {
        method: 'POST',
        path: '/users',
        response: () =>
          jsonResponse({ status: 409, code: 'user.email_taken' }, 409, 'application/problem+json'),
      },
    ])
    renderRoute('/app/users')

    await userEvent.type(await screen.findByLabelText('Nama'), 'Sari')
    await userEvent.type(screen.getByLabelText('Email Google'), 'taken@gmail.test')
    await userEvent.click(screen.getByRole('button', { name: 'Undang' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Email ini sudah terdaftar di EventLy.')
  })
})
