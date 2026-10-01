import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { errorMessage } from '@/shared/lib/errors'
import { fetchWhatsAppLink, type InvitationSummary } from './api'

/**
 * "Kirim via WhatsApp" and "Salin link" (decision Q-27). WhatsApp opens with the message ready; the
 * organizer still presses Send. The window is opened before the request so pop-up blockers allow it.
 */
export function InvitationActions({ invitation }: { invitation: InvitationSummary }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<unknown>(null)

  if (invitation.status === 'Revoked') {
    return <span className="text-sm text-stone-500">{t('guests.revoked')}</span>
  }

  async function sendWhatsApp() {
    setError(null)
    const tab = window.open('', '_blank')
    try {
      const link = await fetchWhatsAppLink(invitation.id)
      if (tab) tab.location.href = link.url
      else window.location.assign(link.url)
    } catch (e) {
      tab?.close()
      setError(e)
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(invitation.url)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void sendWhatsApp()}
        className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white"
      >
        {t('guests.sendWhatsApp')}
      </button>
      <button
        type="button"
        onClick={() => void copy()}
        className="rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-700"
      >
        {copied ? t('guests.copied') : t('guests.copyLink')}
      </button>
      {error !== null && <span className="text-sm text-red-700">{errorMessage(t, error)}</span>}
    </div>
  )
}
