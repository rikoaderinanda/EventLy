import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { EventListItem } from '@/features/events/api'
import { pickEvent } from '@/features/events/selected-event'
import { changeLocale } from '@/i18n'
import { renderRoute } from '@/test/renderRoute'
import { jsonResponse, signInAs, stubApi } from '@/test/session'

const event = (id: string, status: EventListItem['status'], name = `Acara ${id}`): EventListItem => ({
  id,
  name,
  category: 'Wedding',
  timeZone: 'Asia/Jakarta',
  date: '2026-12-12T04:00:00Z',
  venue: 'Gedung',
  status,
})

describe('selected event (Q-59)', () => {
  it('prefers the stored choice, then the only Active event, then the only event', () => {
    const events = [event('a', 'Draft'), event('b', 'Active'), event('c', 'Completed')]
    expect(pickEvent(events, 'c')?.id).toBe('c')
    expect(pickEvent(events, undefined)?.id).toBe('b')
    expect(pickEvent(events, 'gone')?.id).toBe('b')
    expect(pickEvent([event('a', 'Draft')], undefined)?.id).toBe('a')
    expect(pickEvent([event('a', 'Active'), event('b', 'Active')], undefined)).toBeNull()
    expect(pickEvent([], undefined)).toBeNull()
  })
})

describe('organizer frame', () => {
  beforeEach(() => {
    changeLocale('id')
    signInAs('Owner')
  })

  it('points the event menus at the only Active event', async () => {
    stubApi([
      {
        path: '/events',
        response: () => jsonResponse([event('e1', 'Draft'), event('e2', 'Active', 'Resepsi Rina & Budi')]),
      },
    ])
    renderRoute('/app/settings')

    const sidebar = (await screen.findAllByRole('navigation', { name: 'Menu' }))[0]!
    expect(await within(sidebar).findByRole('link', { name: 'Tamu' })).toHaveAttribute(
      'href',
      '/app/events/e2/guests',
    )
    expect(within(sidebar).getByRole('link', { name: 'Pengaturan' })).toHaveAttribute('aria-current', 'page')
    expect(
      screen.getAllByRole('button', { name: /Acara terpilih: Resepsi Rina & Budi/ }).length,
    ).toBeGreaterThan(0)
  })

  it('asks which event when there is a real choice, then opens its page', async () => {
    stubApi([
      {
        path: '/events',
        response: () => jsonResponse([event('e1', 'Active'), event('e2', 'Active', 'Seminar')]),
      },
    ])
    renderRoute('/app/settings')

    const sidebar = (await screen.findAllByRole('navigation', { name: 'Menu' }))[0]!
    await userEvent.click(await within(sidebar).findByRole('button', { name: 'Tamu' }))
    const dialog = await screen.findByRole('dialog', { name: 'Pilih acara' })
    await userEvent.click(within(dialog).getByRole('button', { name: /Seminar/ }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // The guest page of the chosen event opened, and the menu now links there.
    expect(within(sidebar).getByRole('link', { name: 'Tamu' })).toHaveAttribute(
      'href',
      '/app/events/e2/guests',
    )
    // The guest page is lazy-loaded, so the navigation finishes a moment later.
    await waitFor(() =>
      expect(within(sidebar).getByRole('link', { name: 'Tamu' })).toHaveAttribute('aria-current', 'page'),
    )
  })

  it('shows the profile page with language and sign out', async () => {
    stubApi([{ path: '/events', response: () => jsonResponse([]) }])
    renderRoute('/app/settings')

    expect(await screen.findByRole('heading', { name: 'Pengaturan', level: 1 })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'English' }))
    expect(await screen.findByRole('heading', { name: 'Settings', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })
})
