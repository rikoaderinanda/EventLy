import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { changeLocale } from '@/i18n'
import { initials } from './initials'
import { CheckInBadge, RsvpBadge } from './Badge'
import { Button } from './Button'
import { ProgressRing } from './Feedback'
import { Switch, TextField } from './Input'
import { Modal } from './Modal'

describe('design system', () => {
  beforeEach(() => {
    changeLocale('id')
  })

  it('keeps the label as the accessible name and links hint and error', () => {
    render(
      <>
        <TextField label="Nama tamu" name="name" required hint="Seperti di undangan." />
        <TextField label="Email" name="email" error="Format email belum benar." />
      </>,
    )
    const name = screen.getByLabelText('Nama tamu')
    expect(name).toBeRequired()
    expect(name).toHaveAccessibleDescription('Seperti di undangan.')
    const email = screen.getByLabelText('Email')
    expect(email).toBeInvalid()
    expect(email).toHaveAccessibleDescription('Format email belum benar.')
  })

  it('disables a loading button and keeps its label', async () => {
    const onClick = vi.fn()
    render(
      <Button loading onClick={onClick}>
        Simpan
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Simpan' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('opens a modal with focus inside, closes on Escape and returns focus', async () => {
    function Demo() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <Button onClick={() => setOpen(true)}>Buka</Button>
          <Modal
            open={open}
            onClose={() => setOpen(false)}
            title="Hapus tamu?"
            footer={<Button>Hapus</Button>}
          >
            isi
          </Modal>
        </>
      )
    }
    render(<Demo />)
    const opener = screen.getByRole('button', { name: 'Buka' })
    await userEvent.click(opener)

    const dialog = screen.getByRole('dialog', { name: 'Hapus tamu?' })
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
    await userEvent.tab()
    await userEvent.tab()
    await userEvent.tab()
    expect(dialog).toContainElement(document.activeElement as HTMLElement)

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })

  it('shows status with words, not colour alone', () => {
    render(
      <>
        <RsvpBadge status="Attending" />
        <CheckInBadge checkedInAt={null} />
        <ProgressRing value={182} max={250} label="RSVP terjawab" />
      </>,
    )
    expect(screen.getByText('Hadir')).toBeInTheDocument()
    expect(screen.getByText('Belum check-in')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'RSVP terjawab' })).toHaveAttribute('aria-valuenow', '182')
    expect(screen.getByText('73%')).toBeInTheDocument()
  })

  it('exposes a switch as a switch', async () => {
    render(<Switch label="Tamu boleh memotret" defaultChecked />)
    const toggle = screen.getByRole('switch', { name: 'Tamu boleh memotret' })
    await userEvent.click(toggle)
    expect(toggle).not.toBeChecked()
  })

  it('makes initials from names', () => {
    expect(initials('Andi Pratama')).toBe('AP')
    expect(initials('Keluarga  Wijaya (Bandung)')).toBe('KB')
    expect(initials('sari')).toBe('S')
    expect(initials('  ')).toBe('?')
  })
})
