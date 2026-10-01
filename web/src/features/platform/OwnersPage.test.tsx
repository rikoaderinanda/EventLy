import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { changeLocale } from '@/i18n'
import { renderRoute } from '@/test/renderRoute'
import { jsonResponse, signInAs, stubApi } from '@/test/session'

const owners = [
  {
    id: 'o1',
    name: 'Rina',
    email: 'rina@x.test',
    status: 'Active',
    organization: { id: 'org1', name: 'Santoso WO', status: 'Active' },
    purchases: { events: 2, paidEvents: 1, pendingPayments: 0 },
    createdAt: '',
    lastSignInAt: null,
  },
]

describe('OwnersPage (Root)', () => {
  beforeEach(() => {
    changeLocale('id')
    signInAs('Root')
  })

  it('suspends an owner after confirmation', async () => {
    const fetchMock = stubApi([
      { path: '/platform/owners', response: () => jsonResponse(owners) },
      { method: 'POST', path: '/platform/owners/o1/suspend', response: () => jsonResponse(null, 204) },
    ])
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    )
    renderRoute('/platform')

    const row = (await within(await screen.findByRole('main')).findByText('Rina')).closest('li')!
    expect(within(row).getByText('Santoso WO')).toBeInTheDocument()
    await userEvent.click(within(row).getByRole('button', { name: 'Nonaktifkan' }))

    expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith('/platform/owners/o1/suspend'))).toBe(true)
  })

  it('does nothing when the confirmation is cancelled', async () => {
    const fetchMock = stubApi([{ path: '/platform/owners', response: () => jsonResponse(owners) }])
    vi.stubGlobal(
      'confirm',
      vi.fn(() => false),
    )
    renderRoute('/platform')

    await userEvent.click(await screen.findByRole('button', { name: 'Nonaktifkan' }))

    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('/suspend'))).toBe(false)
  })
})
