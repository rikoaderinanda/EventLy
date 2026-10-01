import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { resetDemo } from '@/features/invitation/demo'
import { changeLocale } from '@/i18n'
import { renderRoute } from '@/test/renderRoute'
import { jsonResponse, stubApi } from '@/test/session'

describe('landing page', () => {
  beforeEach(() => {
    changeLocale('id')
    stubApi([
      {
        path: '/system/info',
        response: () => jsonResponse({ name: 'EventLy', version: '0.1.0', environment: 'Development' }),
      },
    ])
  })

  it('says what EventLy is and offers sign-up and the demo', async () => {
    renderRoute('/')

    expect(screen.getByRole('heading', { level: 1, name: /Buat acara lebih berkesan/ })).toBeInTheDocument()
    const hero = screen.getByRole('heading', { level: 1 }).closest('section')!
    expect(within(hero).getByRole('link', { name: 'Mulai Sekarang' })).toHaveAttribute('href', '/login')
    expect(within(hero).getByRole('link', { name: 'Lihat Demo Undangan' })).toHaveAttribute('href', '/i/demo')
    for (const section of ['Fitur', 'Cara kerja', 'Harga', 'FAQ']) {
      expect(screen.getAllByRole('link', { name: section })[0]).toHaveAttribute(
        'href',
        expect.stringMatching(/^#/),
      )
    }
  })

  it('shows the three packages with their real limits, equally weighted', () => {
    renderRoute('/')

    const pricing = screen.getByRole('region', { name: 'Pilihan sesuai kebutuhan acara' })
    for (const name of ['Basic', 'Premium', 'Enterprise']) {
      expect(within(pricing).getByRole('heading', { level: 3, name })).toBeInTheDocument()
    }
    const premium = within(pricing).getByRole('heading', { level: 3, name: 'Premium' }).closest('article')!
    expect(within(premium).getByText(/Rp\s?350\.000/)).toBeInTheDocument()
    expect(within(premium).getByText('500 tamu')).toBeInTheDocument()
    expect(within(premium).getByText('Kamera tamu (5 foto/undangan)')).toBeInTheDocument()
    const table = within(pricing).getByRole('table', { name: 'Bandingkan paket' })
    expect(within(table).getByRole('row', { name: /Jumlah tamu 150 500 5\.000/ })).toBeInTheDocument()
    // No ranking nudges and no invented social proof.
    expect(
      screen.queryByText(/terpopuler|paling populer|best seller|nomor satu|dipercaya/i),
    ).not.toBeInTheDocument()
  })

  it('answers the FAQ with native disclosure widgets', async () => {
    renderRoute('/')

    const question = screen.getByText('Apakah tamu perlu login?')
    const details = question.closest('details')!
    expect(details).not.toHaveAttribute('open')
    await userEvent.click(question)
    expect(details).toHaveAttribute('open')
    expect(within(details).getByText(/Tamu cukup membuka link undangan/)).toBeVisible()
  })

  it('switches the page to English', async () => {
    renderRoute('/')

    await userEvent.click(screen.getByRole('button', { name: 'EN' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: /Make every event memorable/ }),
    ).toBeInTheDocument()
    changeLocale('id')
  })
})

describe('demo invitation', () => {
  beforeEach(() => {
    changeLocale('id')
    resetDemo()
  })

  it('runs in the browser only: fictional data, themes to try, local RSVP', async () => {
    // Every request would answer 404; the demo must not make any.
    const fetchMock = stubApi([])
    const { container } = renderRoute('/i/demo')

    expect(await screen.findByText('Contoh undangan')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Buka Undangan' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Rina & Budi' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Modern gelap' }))
    const page = container.querySelector<HTMLElement>('[style*="--inv-surface"]')!
    expect(page.style.getPropertyValue('--inv-surface')).toBe('#181b22')

    await userEvent.click(screen.getByRole('button', { name: 'Saya hadir' }))
    expect(await screen.findByText('Terima kasih, Anda akan hadir.')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'QR undangan Anda' })).toHaveAttribute('src', '/demo-qr.svg')
    // Nothing about the demo reaches the server.
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('/public/invitations'))).toBe(false)
  })
})
